#!/usr/bin/env python3
"""Export Blender sprite renders to small WebP files."""

import argparse
import subprocess
import sys
from pathlib import Path

POSES = {"idle", "blink", "talk", "happy", "oops", "think", "wave"}
WHO = {"floyd", "bud"}


def run_cwebp(source, target, quality):
    command = [
        "/opt/homebrew/bin/cwebp",
        "-quiet",
        "-q",
        str(quality),
        "-alpha_q",
        "90",
        "-m",
        "6",
        "-sharp_yuv",
        "-resize",
        "384",
        "384",
        str(source),
        "-o",
        str(target),
    ]
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0 and "sharp_yuv" in result.stderr:
        command.remove("-sharp_yuv")
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "cwebp failed")


def run_small_cwebp(source, target):
    command = [
        "/opt/homebrew/bin/cwebp",
        "-quiet",
        "-q",
        "80",
        "-alpha_q",
        "90",
        "-m",
        "6",
        "-sharp_yuv",
        "-resize",
        "192",
        "192",
        str(source),
        "-o",
        str(target),
    ]
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0 and "sharp_yuv" in result.stderr:
        command.remove("-sharp_yuv")
        result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "cwebp failed")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-dir", type=Path, default=Path("art/build"))
    parser.add_argument("--out-root", type=Path, default=Path("."))
    args = parser.parse_args()

    source_dir = args.build_dir / "sprites"
    output_dir = args.out_root / "web/public/mascots"
    output_dir.mkdir(parents=True, exist_ok=True)
    sources = sorted(source_dir.glob("*.png"))
    if not sources:
        print(f"no PNG sprites found in {source_dir}", file=sys.stderr)
        return 1

    rows = []
    total = 0
    for source in sources:
        stem = source.stem
        parts = stem.split("-", 1)
        if len(parts) != 2 or parts[0] not in WHO or parts[1] not in POSES:
            print(f"unexpected sprite name: {source.name}", file=sys.stderr)
            return 1
        target = output_dir / f"{stem}.webp"
        quality_used = None
        for quality in (80, 70, 60):
            run_cwebp(source, target, quality)
            if target.stat().st_size <= 25 * 1024 or quality == 60:
                quality_used = quality
                break
        small_target = output_dir / f"{stem}@1x.webp"
        run_small_cwebp(source, small_target)
        size = target.stat().st_size
        total += size + small_target.stat().st_size
        rows.append((target.name, size, quality_used))
        rows.append((small_target.name, small_target.stat().st_size, 80))

    print("file\tsize (bytes)\tquality")
    for name, size, quality in rows:
        print(f"{name}\t{size}\t{quality}")
    print(f"folder total: {total} bytes")
    if total > 400 * 1024:
        print("folder total exceeds 400 kB", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
