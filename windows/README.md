# Windows version

Build settings for the Windows app live in `electron-builder.yml`.
The app itself is in `../src`, shared with the Mac version, so any change there updates both apps.

**Download:** https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Windows-Setup.exe

- `Smart-School-Tool-Windows-Setup.exe`: installer with Start menu and desktop shortcuts.
- `Smart-School-Tool-Windows-Portable.exe`: a single file, no install needed.

If Windows says "Windows protected your PC", click **More info → Run anyway** (the app isn't code-signed).

Build it yourself on Windows: `npm install`, then `npm run build:windows`. The files appear in `windows/dist/`.
