# SportApp
Daily activity tracking

## Mobile Conversion

This project is now scaffolded for Capacitor so it can be packaged as an Android and iOS app while keeping the current HTML/CSS/JS app.

### Files added

- `package.json`: Capacitor dependencies and helper scripts
- `capacitor.config.json`: app id, app name, and web directory
- `.gitignore`: ignores `node_modules`
- `scripts/sync-web.js`: copies the static app into `www/` before Capacitor syncs

### Install dependencies

```bash
npm install
```

### Prepare the web bundle for mobile

```bash
npm run prepare:web
```

### Create native projects

```bash
npm run cap:add:android
npm run cap:add:ios
```

### Sync web code into native shells

```bash
npm run cap:sync
```

### Open native projects

```bash
npm run cap:open:android
npm run cap:open:ios
```

### Notes

- Android builds can be finished in Android Studio.
- iOS builds require Xcode on macOS.
- The current setup copies `index.html`, `index.css`, and `index.js` into `www/` before each Capacitor sync.
