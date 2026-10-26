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

Release builds run in GitHub Actions. The resulting desktop builds are unsigned.
