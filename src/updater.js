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

// What the updater is doing is written to updater.log in the app's data folder, so a failed update can be
// looked into. update-state.json remembers which version we were installing, so if the app comes back on the
// old version the update didn't work, and we say so instead of failing quietly.
const dataFile = (name) => path.join(app.getPath("userData"), name);

function log(...args) {
  const line = `${new Date().toISOString()} ${args.join(" ")}\n`;
  console.warn("[updater]", ...args);
  try {
    fs.appendFileSync(dataFile("updater.log"), line);
  } catch {
    // Logging must never break the app.
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(dataFile("update-state.json"), "utf8"));
  } catch {
    return null;
  }
}

function writeState(state) {
  try {
    if (state) fs.writeFileSync(dataFile("update-state.json"), JSON.stringify(state));
    else fs.rmSync(dataFile("update-state.json"), { force: true });
  } catch (err) {
    log("Couldn't save update state:", err.message);
  }
}

// "1.0.47" vs "1.0.45" -> 1
function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1;
  return 0;
}

async function showDialog(options) {
  const { response } = await dialog.showMessageBox({ type: "info", defaultId: 0, cancelId: 1, ...options });
  return response;
}

// ---------- Windows installer: electron-updater does everything ----------

function setupWindowsInstaller() {
  let notified = null;
  // Installing when the app is closed later is handled below too, so electron-updater's own (non-silent) one is off.
  autoUpdater.autoInstallOnAppQuit = false;
  let pending = null;

  autoUpdater.on("update-downloaded", async (info) => {
    pending = info;
    if (notified === info.version) return;
    notified = info.version;
    log(`Downloaded ${info.version}`);
    const choice = await showDialog({
      buttons: ["Restart now", "Later"],
      message: `Smart School Tool ${info.version} is ready to install.`,
      detail: "Restart now to update (takes a few seconds), or it will update by itself the next time you close the app.",
    });
    if (choice === 0) {
      log(`Installing ${info.version} now`);
      writeState({ expect: info.version, at: Date.now() });
      // Silent: no setup wizard (it could hide behind other windows or wait for clicks), and it reopens the app.
      autoUpdater.quitAndInstall(true, true);
    }
  });

  // "Later": install quietly as the app closes.
  app.on("before-quit", () => {
    if (!pending || readState()) return;
    log(`Installing ${pending.version} as the app closes`);
    writeState({ expect: pending.version, at: Date.now() });
    autoUpdater.install(true, false);
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

// Running from the .dmg, or from a randomized "App Translocation" copy, means it isn't installed.
const isInstalledMacApp = (appPath) => Boolean(appPath) && !appPath.startsWith("/Volumes/") && !appPath.includes("/AppTranslocation/");

function canReplaceMacApp(appPath) {
  if (!isInstalledMacApp(appPath)) return false;
  try {
    fs.accessSync(path.dirname(appPath), fs.constants.W_OK);
    fs.accessSync(appPath, fs.constants.W_OK);
    // Newer macOS can stop an app changing itself in Applications ("App Management"), even with permission
    // to the folder. Writing a test file inside the app shows whether that's the case.
    const probe = path.join(appPath, "Contents", ".update-check");
    fs.writeFileSync(probe, "");
    fs.rmSync(probe, { force: true });
    return true;
  } catch (err) {
    log("Can't replace the app by itself:", err.message);
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

// macOS won't let the app replace itself: download it anyway, then the student drags it into Applications
// (no "could not verify" popup, because the app downloaded it, not a browser).
function setupMacManual(installedApp) {
  autoUpdater.autoDownload = false;
  let busy = false;
  autoUpdater.on("update-available", async (info) => {
    if (busy) return;
    busy = true;
    try {
      const newApp = await downloadMacUpdate(info);
      log(`Downloaded ${info.version} for a manual install: ${newApp}`);
      const choice = await showDialog({
        buttons: ["Install now", "Later"],
        message: `Smart School Tool ${info.version} is ready.`,
        detail: "macOS needs you to finish this one: the app will close and show you the new version. Drag it into "
          + "the Applications folder and choose Replace, then open it.",
      });
      if (choice === 0) {
        writeState({ expect: info.version, at: Date.now(), manual: true });
        shell.showItemInFolder(newApp);
        shell.openPath(path.dirname(installedApp));
        setTimeout(() => app.quit(), 800);
      } else {
        busy = false;
      }
    } catch (err) {
      log("Mac update download failed:", err.message);
      busy = false;
    }
  });
}

function setupMac() {
  const installedApp = installedMacAppPath();
  if (!isInstalledMacApp(installedApp)) {
    // Still running from the .dmg (not installed): just offer the download.
    setupNotifyOnly(DOWNLOAD_BASE + "Smart-School-Tool-Mac.dmg");
    return;
  }
  if (!canReplaceMacApp(installedApp)) {
    setupMacManual(installedApp);
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
      app.once("will-quit", () => {
        writeState({ expect: info.version, at: Date.now(), newApp });
        log(`Installing ${info.version} (reopen afterwards: ${relaunch})`);
        swapMacApp(newApp, installedApp, relaunch);
      });
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

// If we were installing an update and the app is still on the old version, the update didn't work: say so,
// and offer the download instead of trying the same thing forever.
async function checkLastUpdate(downloadUrl) {
  const state = readState();
  if (!state || !state.expect) return;
  writeState(null);
  if (compareVersions(app.getVersion(), state.expect) >= 0) {
    log(`Updated to ${app.getVersion()}`);
    return;
  }
  log(`Update to ${state.expect} didn't install (still ${app.getVersion()})`);
  if (state.manual) return; // they chose to drag it in themselves; they'll be asked again next time
  if (state.newApp && fs.existsSync(state.newApp)) {
    // Mac: the new version is already downloaded, so the student can drag it in.
    const choice = await showDialog({
      type: "warning",
      buttons: ["Show me", "Not now"],
      message: `macOS didn't let Smart School Tool ${state.expect} install by itself.`,
      detail: "It's already downloaded: the app will close and show it to you. Drag it into the Applications folder, "
        + "choose Replace, then open it.",
    });
    if (choice === 0) {
      writeState({ expect: state.expect, at: Date.now(), manual: true });
      shell.showItemInFolder(state.newApp);
      shell.openPath(path.dirname(installedMacAppPath() || "/Applications/x"));
      setTimeout(() => app.quit(), 800);
    }
    return;
  }
  const choice = await showDialog({
    type: "warning",
    buttons: ["Download it", "Not now"],
    message: `The update to Smart School Tool ${state.expect} didn't install.`,
    detail: "Your computer may have blocked it (school computers often do). Download the new version and install it "
      + "over this one: your account and everything in it stay.",
  });
  if (choice === 0) shell.openExternal(downloadUrl);
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.logger = { info: (m) => log(m), warn: (m) => log("warn:", m), error: (m) => log("error:", m), debug() {} };
  autoUpdater.on("error", (err) => log("Update failed:", err.message));
  const isMac = process.platform === "darwin";
  checkLastUpdate(DOWNLOAD_BASE + (isMac ? "Smart-School-Tool-Mac.dmg" : "Smart-School-Tool-Windows-Setup.exe"));

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
