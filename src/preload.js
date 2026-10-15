// Desktop app only: the small, safe set of desktop features the app page is allowed to use.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // { installed: boolean, profiles: [{ dir, name, email }] }
  chromeProfiles: () => ipcRenderer.invoke("chrome-profiles"),
  // Opens an email link in the given Chrome profile (or the default browser if profileDir is empty).
  openEmail: (url, profileDir) => ipcRenderer.invoke("open-email", url, profileDir || ""),
});
