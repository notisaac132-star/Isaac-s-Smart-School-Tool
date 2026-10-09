// Game-console style home screen: a row of big icons you move through with the arrow keys,
// the mouse, touch or a game controller. Enter / A opens the selected one; B goes back home.
window.ConsoleHome = (function () {
  const home = document.getElementById("home");
  const tiles = [...document.querySelectorAll("#console-row .console-tile")];
  const title = document.getElementById("console-title");
  const desc = document.getElementById("console-desc");
  const stat = document.getElementById("console-stat");
  let index = 0;

  const isHomeVisible = () => !home.hidden;

  function refresh() {
    const tile = tiles[index];
    title.textContent = tile.dataset.title;
    desc.textContent = tile.dataset.desc;
    stat.textContent = tile.querySelector(".console-stat").textContent;
  }

  function select(i, { focus = true } = {}) {
    index = (i + tiles.length) % tiles.length;
    tiles.forEach((tile, n) => tile.classList.toggle("selected", n === index));
    refresh();
    const tile = tiles[index];
    if (focus) tile.focus({ preventScroll: true });
    tile.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }

  function open() {
    const tile = tiles[index];
    if (tile.classList.contains("locked")) {
      tile.classList.remove("nope");
      void tile.offsetWidth; // restart the shake animation
      tile.classList.add("nope");
      return;
    }
    location.hash = tile.getAttribute("href");
  }

  tiles.forEach((tile, n) => {
    tile.addEventListener("mouseenter", () => select(n, { focus: false }));
    tile.addEventListener("focus", () => {
      if (index !== n) select(n, { focus: false });
    });
    tile.addEventListener("click", (event) => {
      event.preventDefault();
      index = n;
      open();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (!isHomeVisible() || event.target.matches("input, textarea, select")) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(index - 1);
    } else if ((event.key === "Enter" || event.key === " ") && tiles.includes(document.activeElement)) {
      event.preventDefault();
      open();
    }
  });

  // ----- Clock -----
  const clock = document.getElementById("clock");
  function tick() {
    clock.textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  tick();
  setInterval(tick, 15000);

  // ----- Game controller (standard mapping: d-pad 14/15, A = 0, B = 1) -----
  const padHint = document.getElementById("pad-hint");
  let polling = false;
  let lastMove = 0;
  let heldButtons = new Set();

  function pollPads(now) {
    const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean);
    padHint.hidden = pads.length === 0;
    if (pads.length === 0) {
      polling = false;
      return;
    }
    const pad = pads[0];
    const pressed = (i) => pad.buttons[i] && pad.buttons[i].pressed;
    const x = pad.axes[0] || 0;
    const right = pressed(15) || x > 0.6;
    const left = pressed(14) || x < -0.6;

    if (isHomeVisible() && (left || right) && now - lastMove > 220) {
      select(index + (right ? 1 : -1));
      lastMove = now;
    }
    if (!left && !right) lastMove = 0;

    // Only act when a button goes down, not while it's held.
    const down = new Set([0, 1].filter(pressed));
    if (down.has(0) && !heldButtons.has(0) && isHomeVisible()) open();
    if (down.has(1) && !heldButtons.has(1) && !isHomeVisible() && location.hash !== "") location.hash = "#home";
    heldButtons = down;

    requestAnimationFrame(pollPads);
  }

  window.addEventListener("gamepadconnected", () => {
    if (!polling) {
      polling = true;
      requestAnimationFrame(pollPads);
    }
  });

  // Keep the selected icon on screen when the window changes size.
  window.addEventListener("resize", () => {
    if (isHomeVisible()) tiles[index].scrollIntoView({ block: "nearest", inline: "center" });
  });

  // Coming back to the home screen keeps the icon you had selected.
  window.addEventListener("hashchange", () => {
    if (isHomeVisible()) select(index);
  });

  select(0, { focus: false });
  return { refresh, select };
})();
