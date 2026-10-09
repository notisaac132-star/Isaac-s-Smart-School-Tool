// Chromebook (web) version only: offline support + auto-update, an "Install app" button, and the version number.
(function () {
  const VERSION = "__VERSION__";

  // Show the version on the home screen's hint bar, like the desktop app shows it in the title bar.
  const hints = document.querySelector(".console-hints");
  if (hints) {
    const tag = document.createElement("span");
    tag.className = "version-tag";
    tag.textContent = `v${VERSION}`;
    hints.prepend(tag);
  }

  if ("serviceWorker" in navigator) {
    let reloading = false;
    let hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // A newer version just installed itself. Reload once so everything on screen is the new version.
      if (!hadController) {
        hadController = true;
        return;
      }
      if (reloading) return;
      reloading = true;
      location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").then((registration) => {
        // Check for a new version every time the app comes back into view, and every 30 minutes.
        const check = () => registration.update().catch(() => {});
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) check();
        });
        setInterval(check, 30 * 60 * 1000);
      });
    });
  }

  // "Install app" button, shown only when Chrome says the app can be installed (and it isn't yet).
  let installPrompt = null;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "install-btn";
  button.textContent = "⬇ Install app";
  button.hidden = true;
  document.body.append(button);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
  });
  button.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    button.hidden = true;
  });
  window.addEventListener("appinstalled", () => {
    button.hidden = true;
  });
})();
