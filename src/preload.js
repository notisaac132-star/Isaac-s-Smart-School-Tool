// Desktop app only: the small, safe set of desktop features the app page is allowed to use.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // { installed: boolean, profiles: [{ dir, name, email }] }
  chromeProfiles: () => ipcRenderer.invoke("chrome-profiles"),
  // Opens an email link in the given Chrome profile (or the default browser if profileDir is empty).
  openEmail: (url, profileDir) => ipcRenderer.invoke("open-email", url, profileDir || ""),
  // Saves a PDF to a temporary folder (returns its path), so it can be dragged into an email.
  savePdf: (name, bytes) => ipcRenderer.invoke("save-pdf", name, bytes),
  // Starts dragging that saved file out of the app (call from a dragstart event).
  dragFile: (filePath) => ipcRenderer.send("drag-file", filePath),
});
