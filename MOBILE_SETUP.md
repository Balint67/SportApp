# Mobile Setup

This repo uses Capacitor to wrap the existing static web app for Android and iOS.

## 1. Install prerequisites

- Node.js
- npm
- Android Studio for Android builds
- Xcode on macOS for iOS builds

## 2. Install dependencies

```bash
npm install
```

## 3. Add native platforms

```bash
npm run cap:add:android
npm run cap:add:ios
```

## 4. Sync the current web app

```bash
npm run cap:sync
```

This command first copies the static web app into `www/`, then syncs it into the native projects.

## 5. Open the native projects

```bash
npm run cap:open:android
npm run cap:open:ios
```

## 6. Before store submission

- Replace app icons and splash assets
- Set final package id / bundle id
- Test Firebase login inside Android and iOS webviews
- Verify privacy text and store metadata
- Build signed release packages in Android Studio and Xcode

## Current app id

`com.sporttracker.app`

Change this in `capacitor.config.json` before publishing if you want a different final identifier.
