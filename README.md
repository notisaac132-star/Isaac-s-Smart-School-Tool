# Isaac-s-Smart-School-Tool
Isaac's Smart School Tool

A simple school app for Windows and Mac.

## Download

| Computer | Download |
| --- | --- |
| **Windows** | [Installer (.exe)](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Windows-Setup.exe) · [Portable (.exe)](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Windows-Portable.exe) |
| **Mac** | [Mac app (.dmg)](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Mac.dmg) |

Easiest: open the download page, which picks the right file for your computer:
**https://notisaac132-star.github.io/Isaac-s-Smart-School-Tool/**

These links always point to the newest version. Once installed, the app keeps itself up to date (see [Updates](#updates)).

## ⚠️ Mac: "Apple could not verify…" / app won't open

macOS blocks apps that aren't registered with Apple (a $99/year Apple Developer account).
The app is safe; you just have to allow it **once**:

**Option 1: Open Anyway (recommended)**
1. Drag **Smart School Tool** from the .dmg into your **Applications** folder.
2. Double-click it. When the warning appears, click **Done** (not "Move to Trash").
3. Go to **Apple menu → System Settings → Privacy & Security**.
4. Scroll down to **Security**. Next to *"Smart School Tool" was blocked…* click **Open Anyway**.
5. Enter your password (or use Touch ID), then click **Open Anyway** again.

From then on it opens normally. The button only appears for about an hour after step 2, so if it's missing, repeat step 2.

**Option 2: Terminal (if there's no Open Anyway button)**
1. Open **Terminal** (⌘ Space, type `Terminal`, press Enter).
2. Paste this and press Enter:
   ```sh
   xattr -dr com.apple.quarantine "/Applications/Smart School Tool.app"
   ```
3. Open the app from Applications.

This only unblocks this one app. You do **not** need to turn off your Mac's security
(avoid `spctl --master-disable` / "Allow apps from anywhere"; that would let *any* unverified app run).

## Windows: "Windows protected your PC"

Click **More info**, then **Run anyway**. Same reason: the app isn't signed with a paid certificate.

## Updates

- **Windows (installer) and Mac:** the app downloads updates by itself and asks you to restart when a new version is ready
  (or updates the next time you close it). On Mac this means the "could not verify" popup only ever shows up for your first install.
- **Windows portable:** the app tells you when a new version is out and opens the download for you.
- The window title shows the version you have (e.g. *Smart School Tool 1.0.5*).

`download/index.html` is a download page that detects whether you're on a Mac or Windows and shows the right button.

## Features

- **Home screen**: a dark landing page with falling white dots, a greeting and today's date.
- **Accounts**: sign up and log in with email and password. Your teachers and tutors are saved to your account,
  so they show up on any computer you log in on. Forgot your password? Use **Forgot password?** on the log-in screen.
- **Teacher & tutor emails**: add your teachers and tutors (name, optional subject, email). Click an email to start a message.

## How the project is laid out

```
src/        the app itself (shared by both versions)
windows/    Windows build settings + install notes
mac/        Mac build settings + install notes
download/   the "pick your computer" download page and the password-reset page
supabase/   database setup for accounts (schema.sql)
```

Accounts run on [Supabase](https://supabase.com). The project's URL and public (anon/publishable) key live in
`src/config.js`; what each account can see is enforced by row level security in `supabase/schema.sql`.

Every push to GitHub rebuilds **both** the Windows and Mac apps from `src/` and publishes them as the latest release
(`.github/workflows/build-apps.yml`), so a change to the app updates both versions automatically.

## Developing

```sh
npm install
npm start              # run the app
npm run build:windows  # build the Windows .exe files (run on Windows)
npm run build:mac      # build the Mac .dmg (run on a Mac)
```
