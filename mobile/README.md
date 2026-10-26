# Jargle Android

The Android app wraps the built Jargle web app with Capacitor.

## Development

From the repository root, build the web app first, then install the mobile dependencies and sync the Android project:

```sh
cd web
npm ci
npm run build
cd ../mobile
npm ci
npx cap sync android
```

Open `mobile/android` in Android Studio to run the app on a device or emulator. The Android SDK and JDK 21 are required for local builds.

## Release builds

Release APKs are built and signed in GitHub Actions.

The release workflow needs these GitHub secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The Android build reads these environment variables:

- `JARGLE_VERSION_NAME` sets the version name, defaulting to `0.1.0`.
- `JARGLE_VERSION_CODE` sets the integer version code, defaulting to `1`.
- `ANDROID_KEYSTORE_FILE` points to the keystore file.
- `ANDROID_KEYSTORE_PASSWORD` sets the keystore password.
- `ANDROID_KEY_ALIAS` sets the signing key alias.
- `ANDROID_KEY_PASSWORD` sets the signing key password.

If the keystore file is not provided, a local release build remains unsigned.
