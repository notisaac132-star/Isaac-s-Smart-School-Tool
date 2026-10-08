# Isaac-s-Smart-School-Tool
Isaac's Smart School Tool

A simple school app for Windows and Mac.

## Download

| Computer | Download |
| --- | --- |
| **Windows** | [Installer (.exe)](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Windows-Setup.exe) · [Portable (.exe)](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Windows-Portable.exe) |
| **Mac** | [Mac app (.dmg)](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Mac.dmg) |

These links always point to the newest version. Install help is in [`windows/`](windows/README.md) and [`mac/`](mac/README.md).

`download/index.html` is a download page that detects whether you're on a Mac or Windows and shows the right button.

## Features

- **Teacher & tutor emails**: add your teachers and tutors (name, optional subject, email). Click an email to start a message. Contacts are saved on your computer.

## How the project is laid out

```
src/        the app itself (shared by both versions)
windows/    Windows build settings + install notes
mac/        Mac build settings + install notes
download/   the "pick your computer" download page
```

Every push to GitHub rebuilds **both** the Windows and Mac apps from `src/` and publishes them as the latest release
(`.github/workflows/build-apps.yml`), so a change to the app updates both versions automatically.

## Developing

```sh
npm install
npm start              # run the app
npm run build:windows  # build the Windows .exe files (run on Windows)
npm run build:mac      # build the Mac .dmg (run on a Mac)
```
