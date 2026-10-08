# macOS version

Build settings for the Mac app live in `electron-builder.yml`.
The app itself is in `../src`, shared with the Windows version, so any change there updates both apps.

**Download:** https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Mac.dmg

Open the `.dmg` and drag **Smart School Tool** into Applications. It's one universal app for both Apple Silicon and Intel Macs.

The first time you open it, macOS says it can't verify the app (it isn't registered with Apple).
Click **Done**, go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway**.
If there's no button, run this in Terminal instead:

```sh
xattr -dr com.apple.quarantine "/Applications/Smart School Tool.app"
```

Full step-by-step instructions are in the [main README](../README.md).

Build it yourself on a Mac: `npm install`, then `npm run build:mac`. The files appear in `mac/dist/`.
