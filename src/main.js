// Electron entry point: opens the school tool in its own desktop window.
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { setupAutoUpdates } = require("./updater");
const chrome = require("./chrome");

// Email links can open in a chosen Chrome profile (e.g. "School"); see chrome.js and preload.js.
ipcMain.handle("chrome-profiles", () => chrome.listProfiles());
ipcMain.handle("open-email", (_event, url, profileDir) => {
  if (typeof url !== "string" || !/^(https?:|mailto:)/.test(url)) return false;
  if (profileDir && chrome.openInProfile(url, profileDir)) return true;
  shell.openExternal(url);
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 800,
    minWidth: 360,
    minHeight: 500,
    title: "Smart School Tool",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#0b0e16",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Open mailto: and web links in the user's default apps instead of inside the window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    require("electron").shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      require("electron").shell.openExternal(url);
    }
  });

  // Show the version in the title bar so it's easy to see when an update has installed.
  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle(`Smart School Tool ${app.getVersion()}`);
  });

  win.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdates();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
