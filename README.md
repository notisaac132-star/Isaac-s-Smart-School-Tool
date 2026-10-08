# Isaac-s-Smart-School-Tool
Isaac's Smart School Tool

A simple school app that runs as a Windows desktop app (`.exe`) or in a browser.

## Features

- **Teacher & tutor emails** – add your teachers and tutors (name, optional subject, email). Click an email to start a message. Contacts are saved on your computer.

## Getting the Windows app

Every push builds the app automatically on GitHub (see `.github/workflows/build-windows.yml`):

1. Open the repo's **Actions** tab and click the latest **Build Windows app** run.
2. Download the **Smart-School-Tool-Windows** artifact at the bottom of the page and unzip it.
3. Pick one:
   - `Smart-School-Tool-Setup-<version>.exe` – installer (adds a Start menu / desktop shortcut).
   - `Smart-School-Tool-Portable-<version>.exe` – single file, no install, just double-click.

Pushing a tag like `v1.0.0` also attaches these files to a GitHub Release.

Windows may show "Windows protected your PC" because the app isn't code-signed. Click **More info → Run anyway**.

## Developing

```sh
npm install
npm start       # run the desktop app
npm run dist    # build the Windows .exe files into dist/ (best run on Windows)
```

You can also just open `index.html` in a browser.
