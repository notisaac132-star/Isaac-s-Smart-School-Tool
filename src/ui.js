// Small helpers for building screens without a framework.
// Everything the user typed is inserted with textContent (never innerHTML), so it can't inject markup.
window.UI = (function () {
  // h("div", { class: "x", onclick: fn, text: "hi" }, child1, child2)
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
      else if (key in el && typeof value !== "string") el[key] = value;
      else el.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child === undefined || child === null || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  // Line icons (24x24, drawn with the current text colour). Fixed strings, never user data.
  const ICONS = {
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7l8 6 8-6"/>',
    check: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12.5l3 3 5-6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    note: '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4M9 12h6M9 16h6"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2.5h5"/>',
    cards: '<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
  };

  function icon(name, cls = "icon") {
    const span = document.createElement("span");
    span.className = cls;
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
    return span;
  }

  // Header used at the top of every tool's page.
  function pageHeader(title, ...actions) {
    return h("div", { class: "view-header" },
      h("a", { class: "back", href: "#home" }, "← Home"),
      h("h1", { text: title }),
      h("div", { class: "header-actions" }, ...actions));
  }

  function message(el, text, isError = true) {
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(text) && isError);
    el.classList.toggle("success", Boolean(text) && !isError);
  }

  function friendlyError(error) {
    const msg = (error && error.message) || String(error);
    if (/failed to fetch|network|load failed/i.test(msg)) return "Can't reach the server. Check your internet connection and try again.";
    if (/invalid login credentials/i.test(msg)) return "Wrong email or password.";
    if (/already registered|already exists/i.test(msg)) return "There's already an account with that email. Try logging in instead.";
    if (/email not confirmed/i.test(msg)) return "Please confirm your email first. Check your inbox for the link.";
    if (/rate limit/i.test(msg)) return "Too many tries. Please wait a minute and try again.";
    if (/same.*password|different from the old/i.test(msg)) return "Your new password has to be different from your old one.";
    return msg;
  }

  // Shows a short message at the bottom of the window.
  function toast(text, isError = false) {
    let box = document.getElementById("toasts");
    if (!box) {
      box = h("div", { id: "toasts", "aria-live": "polite" });
      document.body.append(box);
    }
    const t = h("div", { class: isError ? "toast error" : "toast", text });
    box.append(t);
    setTimeout(() => t.remove(), 4000);
  }

  // Runs a save/delete and shows a toast if it fails. Returns the result or undefined.
  async function attempt(fn) {
    try {
      return await fn();
    } catch (error) {
      toast(friendlyError(error), true);
      return undefined;
    }
  }

  // ----- Dates -----
  const pad = (n) => String(n).padStart(2, "0");

  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseDateKey(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function daysFromToday(key) {
    const today = parseDateKey(dateKey());
    return Math.round((parseDateKey(key) - today) / 86400000);
  }

  function dueLabel(key) {
    if (!key) return "No due date";
    const diff = daysFromToday(key);
    if (diff === 0) return "Due today";
    if (diff === 1) return "Due tomorrow";
    if (diff === -1) return "Due yesterday";
    if (diff < 0) return `${-diff} days overdue`;
    if (diff < 7) return `Due ${parseDateKey(key).toLocaleDateString(undefined, { weekday: "long" })}`;
    return `Due ${parseDateKey(key).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  function formatTime(hhmm) {
    if (!hhmm) return "";
    const [hour, minute] = hhmm.split(":").map(Number);
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function formatDateTime(iso) {
    return new Date(iso).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }

  function plural(count, word) {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
  }

  // Subjects the user has already typed anywhere, for autocomplete.
  function subjectList() {
    const subjects = new Set();
    for (const item of window.Store.items) {
      const s = item.data && (item.data.subject || (item.kind === "class" && item.data.name));
      if (s) subjects.add(s);
    }
    const list = h("datalist", { id: "subjects-list" });
    [...subjects].sort().forEach((s) => list.append(h("option", { value: s })));
    return list;
  }

  return { h, icon, pageHeader, message, friendlyError, toast, attempt, dateKey, parseDateKey, daysFromToday, dueLabel, formatTime, formatDateTime, plural, subjectList };
})();
