# Chromebook version

Chromebooks (especially school ones) can't install Windows or Mac apps, so the Chromebook version is an
**installable web app**. It's the same app from `../src`, so any change there updates every version.

**Install:** open https://notisaac132-star.github.io/Isaac-s-Smart-School-Tool/app/ in Chrome, then click
**⬇ Install app** (or the install icon at the right end of the address bar). It gets its own icon in the launcher and
opens in its own window.

**Updates itself:** every time it opens online it loads the newest version, so there's nothing to re-download. The
version number shows at the bottom-left of the home screen. It also opens offline (log-in and saving need internet).

**School Chromebook blocks installing?** It still works in a normal Chrome tab. Just bookmark the link.

## What's in this folder

| File | What it does |
| --- | --- |
| `manifest.webmanifest` | App name, icons and colours, so Chrome can install it |
| `sw.js` | Service worker: auto-update (network first) and offline copy |
| `pwa.js` / `pwa.css` | Install button and version number |
| `icons/` | Launcher icons (normal + "maskable" for round/square shapes) |
| `build.sh` | Builds the app from `src/` + these files. GitHub Actions runs it on every release |

Build it yourself: `npm install`, then `sh chromebook/build.sh out/app 1.0.0` and serve `out/` over http(s).
