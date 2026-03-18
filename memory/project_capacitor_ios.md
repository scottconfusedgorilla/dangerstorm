---
name: Capacitor iOS App
description: Plan to build native iOS app via Capacitor — config files ready, needs Mac build
type: project
---

## Capacitor iOS Build Plan

User wants DangerStorm in the App Store. Capacitor config is committed to the repo.

### What's ready (in repo):
- `package.json` with Capacitor dependencies
- `capacitor.config.ts` pointing at live Railway server (www.dangerstorm.net)
- `.gitignore` excludes `ios/`, `android/`, `package-lock.json`

### On the Mac (daughter's machine), run:
```bash
git clone https://github.com/scottconfusedgorilla/dangerstorm.git
cd dangerstorm
npm install
npx cap add ios
npx cap open ios
```
Then hit Run in Xcode.

### Still needed:
- Apple Developer account ($99/year) at developer.apple.com
- App Store screenshots (generate from Xcode simulator)
- App Store listing copy
- App icon: already have icon-512.png and icon.svg, need to generate Xcode asset catalog sizes

### Key detail:
Config uses `server.url = 'https://www.dangerstorm.net'` — the app loads the live site in a native shell. Every Railway deploy auto-updates the app content. Only native shell changes require App Store re-submission.
