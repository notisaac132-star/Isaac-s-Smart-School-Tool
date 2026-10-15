// Desktop app only: the small, safe set of desktop features the app page is allowed to use.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  // { installed: boolean, profiles: [{ dir, name, email }] }
  chromeProfiles: () => ipcRenderer.invoke("chrome-profiles"),
  // Opens an email link in the given Chrome profile (or the default browser if profileDir is empty).
  openEmail: (url, profileDir) => ipcRenderer.invoke("open-email", url, profileDir || ""),
  // Opens the email in its own window on the right half of the screen and moves the app to the left half.
  openEmailSplit: (url, profileDir) => ipcRenderer.invoke("open-email-split", url, profileDir || ""),
  // Saves a PDF to a temporary folder (returns its path), so it can be dragged into an email.
  savePdf: (name, bytes) => ipcRenderer.invoke("save-pdf", name, bytes),
  // Starts dragging that saved file out of the app (call from a dragstart event).
  dragFile: (filePath) => ipcRenderer.send("drag-file", filePath),
  // Google sign-in in the student's browser (Chrome profile), for attaching PDFs to Gmail drafts.
  googleSignIn: (clientId, loginHint, profileDir) => ipcRenderer.invoke("google-sign-in", clientId, loginHint || "", profileDir || ""),
  googleCancel: () => ipcRenderer.invoke("google-cancel"),
  googleSignedIn: () => ipcRenderer.invoke("google-signed-in"),
  // Calls Gmail with that sign-in: { ok, status, text }.
  gmailFetch: (pathname, options) => ipcRenderer.invoke("gmail-fetch", pathname, options),
});
