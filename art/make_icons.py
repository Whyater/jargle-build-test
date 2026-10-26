#!/usr/bin/env python3
"""Regenerate the Jargle icon files from Blender build images."""

import argparse
import base64
import io
import re
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

PNG_SIZES = {
    "web/public/icons/apple-touch-icon.png": 180,
    "web/public/icons/favicon-32.png": 32,
    "web/public/icons/icon-192.png": 192,
    "web/public/icons/icon-512.png": 512,
    "web/public/icons/maskable-192.png": 192,
    "web/public/icons/maskable-512.png": 512,
    "web/public/icons/og-image.png": (1200, 630),
    "assets/brand/icon-1024.png": 1024,
    "desktop/src-tauri/icons/32x32.png": 32,
    "desktop/src-tauri/icons/64x64.png": 64,
    "desktop/src-tauri/icons/128x128.png": 128,
    "desktop/src-tauri/icons/128x128@2x.png": 256,
    "desktop/src-tauri/icons/icon.png": 512,
    "desktop/src-tauri/icons/Square30x30Logo.png": 30,
    "desktop/src-tauri/icons/Square44x44Logo.png": 44,
    "desktop/src-tauri/icons/Square71x71Logo.png": 71,
    "desktop/src-tauri/icons/Square89x89Logo.png": 89,
    "desktop/src-tauri/icons/Square107x107Logo.png": 107,
    "desktop/src-tauri/icons/Square142x142Logo.png": 142,
    "desktop/src-tauri/icons/Square150x150Logo.png": 150,
    "desktop/src-tauri/icons/Square284x284Logo.png": 284,
    "desktop/src-tauri/icons/Square310x310Logo.png": 310,
    "desktop/src-tauri/icons/StoreLogo.png": 50,
}

ANDROID = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}


def size_of(path):
    result = subprocess.run(
        ["sips", "-g", "pixelWidth", "-g", "pixelHeight", str(path)],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"cannot inspect {path}")
    values = [int(value) for value in re.findall(r"pixel(?:Width|Height): (\d+)", result.stdout)]
    if len(values) != 2:
        raise RuntimeError(f"cannot read dimensions of {path}")
    return tuple(values)


def resize(source, target, width, height=None):
    if height is None:
        height = width
    target.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        ["sips", "-z", str(height), str(width), str(source), "--out", str(target)],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"sips failed for {target}")


def png_data_uri(path):
    return "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def write_svg(path, png_path, clip):
    clip_text = '<clipPath id="round"><rect width="256" height="256" rx="56"/></clipPath>' if clip else ""
    image_clip = ' clip-path="url(#round)"' if clip else ""
    text = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">'
        f"{clip_text}<image width=\"256\" height=\"256\"{image_clip} href=\"{png_data_uri(png_path)}\"/>"
        "</svg>\n"
    )
    path.write_text(text)


def write_ico(path, png_paths):
    entries = []
    for size in (16, 24, 32, 48, 64, 256):
        data = png_paths[size].read_bytes()
        width = 0 if size == 256 else size
        entries.append((width, size, data))
    header = struct.pack("<HHH", 0, 1, len(entries))
    offset = 6 + 16 * len(entries)
    records = []
    payload = io.BytesIO()
    for width, size, data in entries:
        records.append(struct.pack("<BBBBHHII", width, width, 0, 0, 1, 32, len(data), offset))
        payload.write(data)
        offset += len(data)
    path.write_bytes(header + b"".join(records) + payload.getvalue())


def check_existing(root):
    for relative, expected in PNG_SIZES.items():
        path = root / relative
        if not path.exists():
            raise RuntimeError(f"missing existing output: {path}")
        actual = size_of(path)
        wanted = (expected, expected) if isinstance(expected, int) else expected
        if actual != wanted:
            raise RuntimeError(f"existing size mismatch for {path}: {actual}, expected {wanted}")
    for directory in (root / "mobile/android/app/src/main/res", root / "desktop/src-tauri/icons"):
        if not directory.exists():
            raise RuntimeError(f"missing output directory: {directory}")
    for density, (launcher, foreground) in ANDROID.items():
        base = root / f"mobile/android/app/src/main/res/mipmap-{density}"
        for name, expected in (("ic_launcher.png", launcher), ("ic_launcher_round.png", launcher), ("ic_launcher_foreground.png", foreground)):
            path = base / name
            if not path.exists() or size_of(path) != (expected, expected):
                raise RuntimeError(f"existing size mismatch for {path}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-dir", type=Path, default=Path("art/build"))
    parser.add_argument("--out-root", type=Path, default=Path("."))
    args = parser.parse_args()
    build = args.build_dir
    root = args.out_root
    required = ["icon-full.png", "icon-safe.png", "icon-fg.png", "icon-round.png", "og.png"]
    for name in required:
        if not (build / name).exists():
            raise RuntimeError(f"missing input: {build / name}")
    check_existing(root)

    with tempfile.TemporaryDirectory(prefix="jargle-icons-") as temp_name:
        temp = Path(temp_name)
        full = build / "icon-full.png"
        safe = build / "icon-safe.png"
        foreground = build / "icon-fg.png"
        round_icon = build / "icon-round.png"
        generated = {}
        for size in (16, 24, 32, 48, 64, 128, 256, 512, 1024):
            generated[size] = temp / f"full-{size}.png"
            resize(full, generated[size], size)

        for relative, expected in PNG_SIZES.items():
            target = root / relative
            if relative == "web/public/icons/og-image.png":
                shutil.copyfile(build / "og.png", target)
            elif relative == "assets/brand/icon-1024.png":
                shutil.copyfile(generated[1024], target)
            elif relative.startswith("web/public/icons/maskable"):
                resize(safe, target, expected)
            else:
                size = expected if isinstance(expected, int) else expected[0]
                resize(full, target, size, expected[1] if isinstance(expected, tuple) else None)

        for density, (launcher, foreground_size) in ANDROID.items():
            base = root / f"mobile/android/app/src/main/res/mipmap-{density}"
            resize(full, base / "ic_launcher.png", launcher)
            resize(round_icon, base / "ic_launcher_round.png", launcher)
            resize(foreground, base / "ic_launcher_foreground.png", foreground_size)

        write_svg(root / "web/public/icons/favicon.svg", generated[64], True)
        # The SVG copies just wrap a PNG of the render, since the art is no longer vector.
        write_svg(root / "assets/icon.svg", generated[256], True)
        write_svg(root / "assets/brand/icon.svg", generated[256], True)
        resize(safe, temp / "safe-256.png", 256)
        write_svg(root / "assets/brand/icon-maskable.svg", temp / "safe-256.png", False)

        desktop = root / "desktop/src-tauri/icons"
        for name, size in (("32x32.png", 32), ("64x64.png", 64), ("128x128.png", 128), ("128x128@2x.png", 256), ("icon.png", 512)):
            resize(full, desktop / name, size)
        for path in desktop.glob("Square*x*Logo.png"):
            match = re.search(r"Square(\d+)x\1Logo", path.name)
            if match:
                resize(full, path, int(match.group(1)))
        resize(full, desktop / "StoreLogo.png", 50)
        iconset = temp / "icon.iconset"
        iconset.mkdir()
        for size, name in ((16, "icon_16x16.png"), (32, "icon_16x16@2x.png"), (32, "icon_32x32.png"), (64, "icon_32x32@2x.png"), (128, "icon_128x128.png"), (256, "icon_128x128@2x.png"), (256, "icon_256x256.png"), (512, "icon_256x256@2x.png"), (512, "icon_512x512.png"), (1024, "icon_512x512@2x.png")):
            shutil.copyfile(generated[size], iconset / name)
        result = subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(desktop / "icon.icns")], check=False, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "iconutil failed")
        ico_sources = {size: generated[size] for size in (16, 32, 64, 256)}
        ico_sources[24] = temp / "full-24.png"
        ico_sources[48] = temp / "full-48.png"
        write_ico(desktop / "icon.ico", ico_sources)

    print("path\tsize\tbytes")
    outputs = list(PNG_SIZES) + [
        f"mobile/android/app/src/main/res/mipmap-{d}/{name}"
        for d, _ in ANDROID.items()
        for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png")
    ]
    for relative in outputs:
        path = root / relative
        actual = size_of(path)
        print(f"{relative}\t{actual[0]}x{actual[1]}\t{path.stat().st_size}")
    for relative in ("web/public/icons/favicon.svg", "assets/icon.svg", "assets/brand/icon.svg", "assets/brand/icon-maskable.svg", "desktop/src-tauri/icons/icon.icns", "desktop/src-tauri/icons/icon.ico"):
        path = root / relative
        print(f"{relative}\tfile\t{path.stat().st_size}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
