<img src="../docs/logos/apple.svg" width="64" align="right" alt="">

# Install on a Mac

[← Pick a different computer](../INSTALL.md)

### [**⬇ Download for Mac (.dmg)**](https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/Smart-School-Tool-Mac.dmg)

Works on every Mac: Apple Silicon (M1, M2, M3, …) and Intel.

## Steps

1. **Download it.** Click **Download for Mac** above. Your browser saves *Smart-School-Tool-Mac.dmg* in **Downloads**.
2. **Open the file.** Double-click *Smart-School-Tool-Mac.dmg*. A window opens.
3. **Drag the app into Applications.** Drag the **Smart School Tool** icon onto the **Applications** folder in that window.
4. **Open it.** Open **Applications** (in Finder, or press **⌘ Space**, type *Smart School Tool*, press Enter).
5. **"Apple could not verify…"?** This appears the first time because the app isn't registered with Apple.
   1. Click **Done**, **not** "Move to Trash".
   2. Open **Apple menu → System Settings → Privacy & Security**.
   3. Scroll down to **Security**. Next to *"Smart School Tool" was blocked…* click **Open Anyway**.
   4. Enter your Mac password (or use Touch ID), then click **Open Anyway** again.

   You only do this once.
6. **Make your account.** Click **Sign up**, enter your name, email and a password, then add your teacher's email.

## Updates

Nothing to do. The app downloads new versions by itself and asks you to restart. Because it updates itself, the "could not
verify" message never comes back. The version number is in the window's title bar.

## Having trouble?

- **No "Open Anyway" button?** It only shows for about an hour after you try to open the app. Double-click the app again,
  click **Done**, and check **Privacy & Security** again.
- **Still blocked?** Open **Terminal** (⌘ Space, type *Terminal*, press Enter), paste this and press Enter:
  ```sh
  xattr -dr com.apple.quarantine "/Applications/Smart School Tool.app"
  ```
  Then open the app again. This only unblocks this one app. You don't need to turn off your Mac's security.
- **Want to remove it?** Drag **Smart School Tool** from **Applications** to the **Trash**. Your account and study log
  stay saved.
