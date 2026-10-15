// Electron entry point: opens the school tool in its own desktop window.
const { app, BrowserWindow, ipcMain, nativeImage, shell } = require("electron");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { setupAutoUpdates } = require("./updater");
const chrome = require("./chrome");
const google = require("./google");

// Email links can open in a chosen Chrome profile (e.g. "School"); see chrome.js and preload.js.
ipcMain.handle("chrome-profiles", () => chrome.listProfiles());
ipcMain.handle("open-email", (_event, url, profileDir) => {
  if (typeof url !== "string" || !/^(https?:|mailto:)/.test(url)) return false;
  if (profileDir && chrome.openInProfile(url, profileDir)) return true;
  shell.openExternal(url);
  return true;
});

// Gmail attachments: Google sign-in in the student's browser (see google.js).
const openInBrowser = (url, profileDir) => {
  if (!(profileDir && chrome.openInProfile(url, profileDir))) shell.openExternal(url);
};
ipcMain.handle("google-sign-in", (_event, clientId, loginHint, profileDir) =>
  google.getToken({ clientId, loginHint, open: (url) => openInBrowser(url, profileDir) }));
ipcMain.handle("google-cancel", () => google.cancelSignIn());
ipcMain.handle("google-signed-in", () => google.hasToken());
ipcMain.handle("gmail-fetch", (_event, pathname, options) => google.gmailFetch(pathname, options));

// Quick submit: the PDF is saved to a temporary folder so it can be dragged into an email as an attachment.
const dragFolder = path.join(os.tmpdir(), "Smart School Tool");
ipcMain.handle("save-pdf", (_event, name, bytes) => {
  const safe = path.basename(String(name)).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120) || "assignment";
  const file = path.join(dragFolder, /\.pdf$/i.test(safe) ? safe : `${safe}.pdf`);
  fs.mkdirSync(dragFolder, { recursive: true });
  fs.writeFileSync(file, Buffer.from(bytes));
  return file;
});
ipcMain.on("drag-file", (event, file) => {
  // Only files this app saved above can be dragged out.
  if (typeof file !== "string" || path.dirname(file) !== dragFolder || !fs.existsSync(file)) return;
  const icon = nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 48, height: 48 });
  event.sender.startDrag({ file, icon });
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
