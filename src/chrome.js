// Desktop app only (main process): finds Google Chrome and its profiles, and opens a link in a chosen
// profile, so emails open in e.g. the "School" profile instead of whatever browser is the default.
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

function chromeLocations() {
  const home = os.homedir();
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
    const roots = [local, process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"]].filter(Boolean);
    return {
      executables: roots.map((root) => path.join(root, "Google", "Chrome", "Application", "chrome.exe")),
      userData: path.join(local, "Google", "Chrome", "User Data"),
    };
  }
  if (process.platform === "darwin") {
    return {
      executables: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        path.join(home, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"),
      ],
      userData: path.join(home, "Library", "Application Support", "Google", "Chrome"),
    };
  }
  const bins = (process.env.PATH || "").split(path.delimiter).flatMap((dir) =>
    ["google-chrome", "google-chrome-stable"].map((name) => path.join(dir, name)));
  return { executables: bins, userData: path.join(home, ".config", "google-chrome") };
}

function findChrome() {
  const { executables, userData } = chromeLocations();
  const executable = executables.find((file) => {
    try {
      fs.accessSync(file, fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
  return { executable: executable || null, userData };
}

// Chrome keeps every profile's name (and signed-in email) in "Local State".
function listProfiles() {
  const { executable, userData } = findChrome();
  if (!executable) return { installed: false, profiles: [] };
  try {
    const state = JSON.parse(fs.readFileSync(path.join(userData, "Local State"), "utf8"));
    const cache = (state.profile && state.profile.info_cache) || {};
    const profiles = Object.entries(cache)
      .map(([dir, info]) => ({ dir, name: info.name || dir, email: info.user_name || "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { installed: true, profiles };
  } catch {
    return { installed: true, profiles: [] };
  }
}

// Opens a web or mailto link in the given Chrome profile. Returns false if it couldn't (then the caller
// falls back to the default browser). `windowOptions` ({ x, y, width, height }) opens it in a new window there.
function openInProfile(url, profileDir, windowOptions) {
  const { executable } = findChrome();
  if (!executable || !/^(https?:|mailto:)/.test(url)) return false;
  // Only ever pass a profile Chrome actually has (it's also passed as a separate argument, not via a shell).
  if (!listProfiles().profiles.some((p) => p.dir === profileDir)) return false;
  const args = [`--profile-directory=${profileDir}`];
  if (windowOptions) {
    const n = (value) => Math.round(Number(value)) || 0;
    // Chrome uses the position and size when it isn't running yet; splitscreen.js moves it otherwise.
    args.push("--new-window", `--window-position=${n(windowOptions.x)},${n(windowOptions.y)}`,
      `--window-size=${n(windowOptions.width)},${n(windowOptions.height)}`);
  }
  const child = spawn(executable, [...args, url], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
  return true;
}

module.exports = { listProfiles, openInProfile };
