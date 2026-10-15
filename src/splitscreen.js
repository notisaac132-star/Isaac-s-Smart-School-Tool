// Desktop app only (main process): Quick submit's "drag your PDF into the email" step. Puts the app on the
// left half of the screen and the email, in its own browser window, on the right half, so the PDF can be
// dragged straight across.
const { BrowserWindow, screen, shell } = require("electron");
const { spawn } = require("child_process");
const chrome = require("./chrome");

const BROWSERS = ["chrome", "msedge", "firefox", "brave", "opera", "vivaldi"];

function halves(win) {
  const area = screen.getDisplayMatching(win.getBounds()).workArea;
  const half = Math.floor(area.width / 2);
  return {
    left: { x: area.x, y: area.y, width: half, height: area.height },
    right: { x: area.x + half, y: area.y, width: area.width - half, height: area.height },
  };
}

// Windows: wait for the browser window that comes to the front (the new email window) and move it into
// place. Only browser windows are touched, and only for 10 seconds.
function moveBrowserWindows(rect) {
  const { x, y, width, height } = screen.dipToScreenRect(null, rect); // Windows wants real pixels
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class SstWin {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);
}
"@
[SstWin]::SetProcessDPIAware() | Out-Null
$names = @(${BROWSERS.map((b) => `'${b}'`).join(",")})
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  $h = [SstWin]::GetForegroundWindow()
  [uint32]$p = 0; [SstWin]::GetWindowThreadProcessId($h, [ref]$p) | Out-Null
  $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
  if ($proc -and $names -contains $proc.ProcessName.ToLower()) {
    [SstWin]::ShowWindow($h, 9) | Out-Null
    [SstWin]::MoveWindow($h, ${Math.round(x)}, ${Math.round(y)}, ${Math.round(width)}, ${Math.round(height)}, $true) | Out-Null
    Start-Sleep -Milliseconds 600
    [SstWin]::MoveWindow($h, ${Math.round(x)}, ${Math.round(y)}, ${Math.round(width)}, ${Math.round(height)}, $true) | Out-Null
    exit 0
  }
}`;
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded],
    { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {});
  child.unref();
}

// Mac: ask Chrome to put its front window (the new one) there. macOS asks once whether that's allowed.
function moveChromeWindowMac(rect) {
  const { x, y, width, height } = rect;
  const bounds = [x, y, x + width, y + height].map((n) => Math.round(n)).join(", ");
  const script = `delay 1.5
tell application "Google Chrome" to set bounds of front window to {${bounds}}`;
  const child = spawn("/usr/bin/osascript", ["-e", script], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
}

function openEmailSplit(webContents, url, profileDir) {
  if (typeof url !== "string" || !/^(https?:|mailto:)/.test(url)) return false;
  const win = BrowserWindow.fromWebContents(webContents);
  if (!win) return false;
  const { left, right } = halves(win);
  if (win.isMaximized()) win.unmaximize();
  if (win.isFullScreen()) win.setFullScreen(false);
  win.setBounds(left, true);

  const inChrome = Boolean(profileDir) && chrome.openInProfile(url, profileDir, right);
  if (!inChrome) shell.openExternal(url);
  if (process.platform === "win32") moveBrowserWindows(right);
  else if (process.platform === "darwin" && inChrome) moveChromeWindowMac(right);
  return true;
}

module.exports = { openEmailSplit };
