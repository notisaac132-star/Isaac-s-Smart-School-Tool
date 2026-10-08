// Smart School Tool: accounts (Supabase Auth) and each account's teacher/tutor contacts.

const config = window.APP_CONFIG || {};
const configured = Boolean(config.supabaseUrl && config.supabaseKey && window.supabase);
const db = configured ? window.supabase.createClient(config.supabaseUrl, config.supabaseKey) : null;

// Contacts saved on this computer before accounts existed; moved into the account on first login.
const LEGACY_STORAGE_KEY = "smartSchoolTool.contacts";
const KINDS = { teachers: "teacher", tutors: "tutor" };

let currentUser = null;
const contacts = { teachers: [], tutors: [] };

// ---------- Small helpers ----------

function $(id) {
  return document.getElementById(id);
}

function setMessage(id, text, isError = true) {
  const el = $(id);
  el.textContent = text || "";
  el.classList.toggle("error", Boolean(text) && isError);
  el.classList.toggle("success", Boolean(text) && !isError);
}

function friendlyError(error) {
  const message = (error && error.message) || String(error);
  if (/failed to fetch|network|load failed/i.test(message)) return "Can't reach the server. Check your internet connection and try again.";
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/already registered|already exists/i.test(message)) return "There's already an account with that email. Try logging in instead.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first. Check your inbox for the link.";
  if (/rate limit/i.test(message)) return "Too many tries. Please wait a minute and try again.";
  return message;
}

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// ---------- Screens ----------

function showView() {
  let id = location.hash === "#contacts" ? "contacts" : "home";
  if (!currentUser) id = "auth";
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== id;
  });
  window.scrollTo(0, 0);
}

function greet() {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const name = currentUser && currentUser.user_metadata && currentUser.user_metadata.name;
  $("greeting").textContent = name ? `Good ${part}, ${name}` : `Good ${part}`;
  $("today").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ---------- Log in / sign up ----------

let authMode = "login"; // "login" | "signup" | "reset"

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.setAttribute("aria-selected", String(tab.dataset.mode === mode));
  });
  document.querySelectorAll("#auth [data-only]").forEach((el) => {
    el.hidden = el.dataset.only !== mode;
  });
  document.querySelectorAll("#auth [data-hide]").forEach((el) => {
    el.hidden = el.dataset.hide === mode;
  });
  const password = $("auth-form").elements.password;
  password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("auth-submit").textContent = { login: "Log in", signup: "Create account", reset: "Send reset link" }[mode];
  setMessage("auth-message", "");
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!db) {
    setMessage("auth-message", "Accounts aren't set up yet.");
    return;
  }
  const form = event.target;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  const name = form.elements.name.value.trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) return setMessage("auth-message", "Enter a valid email address.");
  if (authMode !== "reset" && password.length < 8) return setMessage("auth-message", "Your password needs at least 8 characters.");
  if (authMode === "signup" && !name) return setMessage("auth-message", "Enter your name.");

  const submit = $("auth-submit");
  submit.disabled = true;
  setMessage("auth-message", "");
  try {
    if (authMode === "login") {
      const { error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } else if (authMode === "signup") {
      const { data, error } = await db.auth.signUp({ email, password, options: { data: { name } } });
      if (error) throw error;
      if (!data.session) {
        // Email confirmation is switched on in Supabase: they have to click the link first.
        setAuthMode("login");
        form.elements.email.value = email;
        setMessage("auth-message", "Account created! Check your email for a link to confirm it, then log in.", false);
      }
    } else {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: config.resetPasswordUrl });
      if (error) throw error;
      setMessage("auth-message", "If that email has an account, a reset link is on its way.", false);
    }
  } catch (error) {
    setMessage("auth-message", friendlyError(error));
  } finally {
    submit.disabled = false;
  }
}

async function onSignedIn(user) {
  const isNewLogin = !currentUser || currentUser.id !== user.id;
  currentUser = user;
  $("account-email").textContent = user.email;
  greet();
  $("auth-form").reset();
  showView();
  if (isNewLogin) {
    await importLegacyContacts();
    await loadContacts();
  }
}

function onSignedOut() {
  currentUser = null;
  contacts.teachers = [];
  contacts.tutors = [];
  renderAll();
  setAuthMode("login");
  location.hash = "";
  showView();
}

// ---------- Contacts (stored in the account) ----------

async function loadContacts() {
  const { data, error } = await db
    .from("contacts")
    .select("id, kind, name, subject, email")
    .order("created_at", { ascending: true });
  if (error) {
    setMessage("teachers-message", `Couldn't load your contacts: ${friendlyError(error)}`);
    return;
  }
  contacts.teachers = data.filter((c) => c.kind === "teacher");
  contacts.tutors = data.filter((c) => c.kind === "tutor");
  setMessage("teachers-message", "");
  renderAll();
}

// Moves contacts that were saved on this computer (older versions of the app) into the account.
async function importLegacyContacts() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    return;
  }
  if (!saved) return;
  const rows = [];
  for (const [list, kind] of Object.entries(KINDS)) {
    for (const c of saved[list] || []) {
      if (c && c.name && c.email) rows.push({ kind, name: c.name, subject: c.subject || "", email: c.email });
    }
  }
  if (rows.length > 0) {
    const { error } = await db.from("contacts").insert(rows);
    if (error) {
      console.warn("Could not import contacts saved on this computer:", error.message);
      return; // keep them locally and try again next login
    }
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY);
}

function updateSummary() {
  const { teachers, tutors } = contacts;
  $("contacts-summary").textContent = teachers.length + tutors.length === 0
    ? "Add your teachers' and tutors' emails"
    : `${plural(teachers.length, "teacher")} · ${plural(tutors.length, "tutor")}`;
}

function renderAll() {
  render("teachers");
  render("tutors");
}

function render(list) {
  updateSummary();
  const ul = $(`${list}-list`);
  ul.replaceChildren();

  if (contacts[list].length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = list === "teachers" ? "No teachers added yet." : "No tutors added yet.";
    ul.append(empty);
    return;
  }

  contacts[list].forEach((contact) => {
    const item = document.createElement("li");

    const info = document.createElement("div");
    info.className = "contact-info";

    const name = document.createElement("div");
    name.className = "contact-name";
    name.textContent = contact.name;
    if (contact.subject) {
      const subject = document.createElement("span");
      subject.className = "contact-subject";
      subject.textContent = ` · ${contact.subject}`;
      name.append(subject);
    }

    const email = document.createElement("a");
    email.href = `mailto:${contact.email}`;
    email.textContent = contact.email;

    info.append(name, email);

    const remove = document.createElement("button");
    remove.className = "remove-btn";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.addEventListener("click", async () => {
      remove.disabled = true;
      const { error } = await db.from("contacts").delete().eq("id", contact.id);
      if (error) {
        remove.disabled = false;
        setMessage(`${list}-message`, `Couldn't remove: ${friendlyError(error)}`);
        return;
      }
      contacts[list] = contacts[list].filter((c) => c.id !== contact.id);
      setMessage(`${list}-message`, "");
      render(list);
    });

    item.append(info, remove);
    ul.append(item);
  });
}

document.querySelectorAll(".contact-form").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const list = form.dataset.kind;
    const data = new FormData(form);
    const button = form.querySelector("button");
    button.disabled = true;

    const { data: row, error } = await db
      .from("contacts")
      .insert({
        kind: KINDS[list],
        name: data.get("name").trim(),
        subject: data.get("subject").trim(),
        email: data.get("email").trim(),
      })
      .select("id, kind, name, subject, email")
      .single();

    button.disabled = false;
    if (error) {
      setMessage(`${list}-message`, `Couldn't save: ${friendlyError(error)}`);
      return;
    }
    contacts[list].push(row);
    setMessage(`${list}-message`, "");
    render(list);
    form.reset();
    form.querySelector("input").focus();
  });
});

// ---------- Start up ----------

document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.mode)));
$("forgot-btn").addEventListener("click", () => setAuthMode("reset"));
$("back-to-login").addEventListener("click", () => setAuthMode("login"));
$("auth-form").addEventListener("submit", handleAuthSubmit);
$("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
});
window.addEventListener("hashchange", showView);

setAuthMode("login");
renderAll();
greet();
showView();

if (!db) {
  setMessage("auth-message", "Accounts aren't set up yet. Check back after the next update.");
  $("auth-submit").disabled = true;
} else {
  db.auth.onAuthStateChange((event, session) => {
    // Run outside the callback so Supabase calls made from here don't wait on the auth lock.
    setTimeout(() => {
      if (session && session.user) onSignedIn(session.user);
      else if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") onSignedOut();
    }, 0);
  });
}
