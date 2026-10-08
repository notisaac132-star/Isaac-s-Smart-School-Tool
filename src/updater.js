// Keeps installed copies of the app up to date from the project's GitHub Releases.
const { app, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");

const DOWNLOAD_BASE = "https://github.com/notisaac132-star/Isaac-s-Smart-School-Tool/releases/latest/download/";
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

// The Mac app has no paid Apple signature and the portable .exe has no installer,
// so neither can replace itself; for those we just offer the new download.
function notifyOnlyDownloadUrl() {
  if (process.platform === "darwin") return DOWNLOAD_BASE + "Smart-School-Tool-Mac.dmg";
  if (process.env.PORTABLE_EXECUTABLE_DIR) return DOWNLOAD_BASE + "Smart-School-Tool-Windows-Portable.exe";
  return null;
}

function setupAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.on("error", (err) => console.warn("Update check failed:", err.message));

  const downloadUrl = notifyOnlyDownloadUrl();
  let notifiedVersion = null;

  if (downloadUrl) {
    autoUpdater.autoDownload = false;
    autoUpdater.on("update-available", async (info) => {
      if (notifiedVersion === info.version) return;
      notifiedVersion = info.version;
      const { response } = await dialog.showMessageBox({
        type: "info",
        buttons: ["Download", "Later"],
        defaultId: 0,
        cancelId: 1,
        message: `A new version of Smart School Tool (${info.version}) is available.`,
        detail: process.platform === "darwin"
          ? "Download it, open the .dmg and drag the app into Applications, choosing Replace. Your contacts will stay."
          : "Download it and use the new file instead of this one. Your contacts will stay.",
      });
      if (response === 0) shell.openExternal(downloadUrl);
    });
  } else {
    // Windows installer: download in the background, install on restart.
    autoUpdater.on("update-downloaded", async (info) => {
      if (notifiedVersion === info.version) return;
      notifiedVersion = info.version;
      const { response } = await dialog.showMessageBox({
        type: "info",
        buttons: ["Restart now", "Later"],
        defaultId: 0,
        cancelId: 1,
        message: `Smart School Tool ${info.version} is ready to install.`,
        detail: "Restart now to update, or it will update by itself the next time you close the app.",
      });
      if (response === 0) autoUpdater.quitAndInstall();
    });
  }

  const check = () => autoUpdater.checkForUpdates().catch((err) => console.warn("Update check failed:", err.message));
  check();
  setInterval(check, CHECK_EVERY_MS);
}

module.exports = { setupAutoUpdates };
