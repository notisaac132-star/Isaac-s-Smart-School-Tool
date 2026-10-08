# macOS version

Build settings for the Mac app live in `electron-builder.yml`.
The app itself is in `../src`, shared with the Windows version, so any change there updates both apps.

**Download:** https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Mac.dmg

Open the `.dmg` and drag **Smart School Tool** into Applications. It's one universal app for both Apple Silicon and Intel Macs.

The first time you open it, macOS may say it can't verify the developer (the app isn't notarized by Apple).
Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.

Build it yourself on a Mac: `npm install`, then `npm run build:mac`. The files appear in `mac/dist/`.
