# Art

Floyd and Bud, the app icon and the share image are 3D renders made by a
Blender script. Everything here runs from the repository root.

## Render

Blender runs headless. Its window never opens:

```sh
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
$BLENDER -b -P art/mascots/mascots.py
$BLENDER -b -P art/mascots/mascots.py -- --icons art/build
```

The first command renders every pose of both mascots to `art/build/sprites`
at 768 px. Pick some with `--who floyd --poses idle,talk`. The second renders
the icon art and the share image to `art/build`. That folder is not committed.

## Export

```sh
python3 art/export_sprites.py
python3 art/make_icons.py
```

`export_sprites.py` writes `web/public/mascots/<who>-<pose>.webp` at 384 px
and `<who>-<pose>@1x.webp` at 192 px with `cwebp`. It fails if the folder goes
over 400 kB.
`make_icons.py` rewrites every web, desktop and Android icon at the size it
already has, using `sips` and `iconutil` from macOS.

To try them on another folder, pass `--build-dir` and `--out-root`.
