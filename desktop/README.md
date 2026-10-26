# Jargle desktop

Build the web app first:

```sh
npm --prefix web run build
```

From `desktop/`, install the Tauri CLI and run the app:

```sh
npm ci
npm run dev
```

Build release bundles with:

```sh
npm run build
```

Release builds run in GitHub Actions. The resulting desktop builds are not
signed by Apple or Microsoft.

## Updates

The app updates itself from GitHub releases. A few seconds after launch, and
every 6 hours after that, it reads `latest.json` from the newest release.
When there is a newer version, it shows an "A new Jargle is ready!" card with
an Update now button.

Each update file is signed with a private key, and the app checks that
signature with the public key in `src-tauri/tauri.conf.json` before it
installs anything. Because of that, `npm run build` needs the private key in
two environment variables:

```sh
export TAURI_SIGNING_PRIVATE_KEY="path or contents of the private key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="its password"
```

In GitHub Actions they come from repository secrets with the same names. If
the private key is ever lost, already installed apps can't take updates any
more. Everyone would have to install the new version by hand once.
