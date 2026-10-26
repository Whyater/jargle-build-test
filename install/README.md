# Install Jargle

Jargle is a daily tech word game. Choose the install method for your device below.

## Mac

Run this in Terminal:

```sh
curl -fsSL https://whyater.github.io/Jargle/install.sh | bash
```

You can also download [Jargle-mac.dmg](https://github.com/Whyater/Jargle/releases/latest/download/Jargle-mac.dmg). The app is not signed with a paid Apple certificate. The first time you open it from the DMG, macOS may block it. Right-click (or Control-click) Jargle in Applications, choose Open, then choose Open again. On newer macOS versions, if there is no Open button, go to System Settings > Privacy & Security, scroll down, and click Open Anyway. The one-line command avoids this step.

## Windows

Run this in PowerShell:

```powershell
irm https://whyater.github.io/Jargle/install.ps1 | iex
```

You can also download [Jargle-windows-setup.exe](https://github.com/Whyater/Jargle/releases/latest/download/Jargle-windows-setup.exe). If SmartScreen says Windows protected your PC, click More info, then Run anyway. No admin access is needed. The [Jargle-windows.msi](https://github.com/Whyater/Jargle/releases/latest/download/Jargle-windows.msi) file is for managed installs.

## Android

Download [Jargle-android.apk](https://github.com/Whyater/Jargle/releases/latest/download/Jargle-android.apk) from the [releases page](https://github.com/Whyater/Jargle/releases/latest). Allow installs from your browser when asked.

## iPhone

Open [the web app](https://whyater.github.io/Jargle/) in Safari, tap Share, then Add to Home Screen.

## Uninstall

On Mac, run this to remove the app and keep your progress:

```sh
curl -fsSL https://whyater.github.io/Jargle/uninstall.sh | bash
```

To remove the app and local progress too, use:

```sh
curl -fsSL https://whyater.github.io/Jargle/uninstall.sh | bash -s -- --purge
```

On Windows, use Settings > Apps > Jargle. You can also run the uninstall.exe next to Jargle.exe.

## For testers

Set `JARGLE_RELEASES_BASE` to use another release folder. By default, downloads use `https://github.com/Whyater/Jargle/releases/latest/download`. Set `JARGLE_INSTALL_DIR` to choose the Mac install folder.

For example:

```sh
JARGLE_RELEASES_BASE=https://github.com/Whyater/Jargle/releases/latest/download JARGLE_INSTALL_DIR="$HOME/Applications" bash install.sh
```
