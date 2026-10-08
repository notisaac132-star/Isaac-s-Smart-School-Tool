// Electron entry point: opens the school tool in its own desktop window.
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { setupAutoUpdates } = require("./updater");

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 800,
    minWidth: 360,
    minHeight: 500,
    title: "Smart School Tool",
    icon: path.join(__dirname, "icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
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
