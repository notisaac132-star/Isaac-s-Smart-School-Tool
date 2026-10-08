// Keeps installed copies of the app up to date from the project's GitHub Releases.
const { app, dialog, shell, net } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn, execFile } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const REPO_URL = "https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool";
const DOWNLOAD_BASE = `${REPO_URL}/releases/latest/download/`;
const MAC_ZIP = "Smart-School-Tool-Mac.zip";
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

// Waits for the app to quit, swaps the new .app bundle into place, then optionally reopens it.
// Arguments: $1 = pid to wait for, $2 = new .app, $3 = installed .app, $4 = "1" to relaunch.
const MAC_SWAP_SCRIPT = `
while kill -0 "$1" 2>/dev/null; do sleep 0.3; done
rm -rf "$3.old"
if mv "$3" "$3.old" && mv "$2" "$3"; then
  rm -rf "$3.old"
else
  [ -d "$3" ] || mv "$3.old" "$3"
fi
xattr -dr com.apple.quarantine "$3" 2>/dev/null
[ "$4" = "1" ] && open "$3"
exit 0
`;

function log(...args) {
  console.warn("[updater]", ...args);
}

async function showDialog(options) {
  const { response } = await dialog.showMessageBox({ type: "info", defaultId: 0, cancelId: 1, ...options });
  return response;
}

// ---------- Windows installer: electron-updater does everything ----------

function setupWindowsInstaller() {
  let notified = null;
  autoUpdater.on("update-downloaded", async (info) => {
    if (notified === info.version) return;
    notified = info.version;
    const choice = await showDialog({
      buttons: ["Restart now", "Later"],
      message: `Smart School Tool ${info.version} is ready to install.`,
      detail: "Restart now to update, or it will update by itself the next time you close the app.",
    });
    if (choice === 0) autoUpdater.quitAndInstall();
  });
}

// ---------- Windows portable: can't replace itself, so offer the download ----------

function setupNotifyOnly(downloadUrl) {
  let notified = null;
  autoUpdater.autoDownload = false;
  autoUpdater.on("update-available", async (info) => {
    if (notified === info.version) return;
    notified = info.version;
    const choice = await showDialog({
      buttons: ["Download", "Later"],
      message: `A new version of Smart School Tool (${info.version}) is available.`,
      detail: "Download it and use the new file instead of this one. Your contacts will stay.",
    });
    if (choice === 0) shell.openExternal(downloadUrl);
  });
}

// ---------- Mac: download the new app ourselves and swap it in ----------
// macOS only shows the "could not verify" popup for files that were downloaded by a browser
// (they get a quarantine flag). Files this app downloads itself don't, so updates open without it.

function installedMacAppPath() {
  // .../Smart School Tool.app/Contents/MacOS/Smart School Tool -> .../Smart School Tool.app
  const appPath = path.resolve(process.execPath, "..", "..", "..");
  return appPath.endsWith(".app") ? appPath : null;
}

function canReplaceMacApp(appPath) {
  // Running from the .dmg, or from a randomized "App Translocation" copy, means it isn't installed.
  if (!appPath || appPath.startsWith("/Volumes/") || appPath.includes("/AppTranslocation/")) return false;
  try {
    fs.accessSync(path.dirname(appPath), fs.constants.W_OK);
    fs.accessSync(appPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function sha512Base64(file) {
  const hash = crypto.createHash("sha512");
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest("base64");
}

async function downloadMacUpdate(info) {
  const entry = (info.files || []).find((f) => f.url.endsWith(".zip"));
  if (!entry || !entry.sha512) throw new Error("Update info has no .zip file");

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "smart-school-update-"));
  const zipPath = path.join(workDir, MAC_ZIP);
  const url = `${REPO_URL}/releases/download/v${info.version}/${entry.url}`;

  const response = await net.fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(zipPath));

  if ((await sha512Base64(zipPath)) !== entry.sha512) throw new Error("Downloaded update is corrupted");

  const unpackDir = path.join(workDir, "unpacked");
  // ditto is macOS's own unzip; it keeps the app's code signature and symlinks intact.
  await new Promise((resolve, reject) =>
    execFile("/usr/bin/ditto", ["-x", "-k", zipPath, unpackDir], (err) => (err ? reject(err) : resolve()))
  );
  const newApp = fs.readdirSync(unpackDir).find((name) => name.endsWith(".app"));
  if (!newApp) throw new Error("No app found in the update");
  return path.join(unpackDir, newApp);
}

function swapMacApp(newApp, installedApp, relaunch) {
  spawn("/bin/sh", ["-c", MAC_SWAP_SCRIPT, "sh", String(process.pid), newApp, installedApp, relaunch ? "1" : "0"], {
    detached: true,
    stdio: "ignore",
  }).unref();
}

function setupMac() {
  const installedApp = installedMacAppPath();
  if (!canReplaceMacApp(installedApp)) {
    // Not installed in a folder we can write to (e.g. still running from the .dmg): just offer the download.
    setupNotifyOnly(DOWNLOAD_BASE + "Smart-School-Tool-Mac.dmg");
    return;
  }

  autoUpdater.autoDownload = false;
  let busy = false;
  let readyApp = null;

  autoUpdater.on("update-available", async (info) => {
    if (busy || readyApp) return;
    busy = true;
    try {
      const newApp = await downloadMacUpdate(info);
      readyApp = newApp;
      // The swap happens as the app quits: right away for "Restart now", or whenever they next quit for "Later".
      let relaunch = false;
      app.once("will-quit", () => swapMacApp(newApp, installedApp, relaunch));
      const choice = await showDialog({
        buttons: ["Restart now", "Later"],
        message: `Smart School Tool ${info.version} is ready to install.`,
        detail: "Restart now to update, or it will update by itself the next time you quit the app.",
      });
      if (choice === 0) {
        relaunch = true;
        app.quit();
      }
    } catch (err) {
      log("Mac update failed:", err.message);
    } finally {
      busy = false;
    }
  });
}

// ---------- Entry point ----------

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.on("error", (err) => log("Update check failed:", err.message));

  if (process.platform === "darwin") {
    setupMac();
  } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    setupNotifyOnly(DOWNLOAD_BASE + "Smart-School-Tool-Windows-Portable.exe");
  } else {
    setupWindowsInstaller();
  }

  const check = () => autoUpdater.checkForUpdates().catch((err) => log("Update check failed:", err.message));
  check();
  setInterval(check, CHECK_EVERY_MS);
}

module.exports = { setupAutoUpdates };
