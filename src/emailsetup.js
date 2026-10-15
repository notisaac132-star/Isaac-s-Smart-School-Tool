// Email setup: which email service, and where emails open.
//  - Desktop app (Windows/Mac): pick a Chrome profile; a profile named like "School" is picked for you.
//    Saved per computer (profiles are different on every computer).
//  - Chromebook / browser: a web page can't switch Chrome profiles, so instead you give your school Google
//    account and Gmail opens on that account. Saved in the account.
// Everyone has to finish this once before using the app (app.js sends them here until it's done).
window.EmailSetup = (function () {
  const $ = (id) => document.getElementById(id);
  const isDesktop = Boolean(window.desktop);
  let profiles = [];
  let chromeInstalled = false;

  const meta = () => (currentUser && currentUser.user_metadata) || {};
  const localKey = () => `smartSchoolTool.emailSetup.${currentUser ? currentUser.id : ""}`;

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(localKey()) || "null");
    } catch {
      return null;
    }
  }

  function writeLocal(value) {
    try {
      localStorage.setItem(localKey(), JSON.stringify(value));
    } catch {
      // If this computer can't save it, they'll just be asked again next time.
    }
  }

  function isDone() {
    if (!currentUser) return true;
    return isDesktop ? Boolean(readLocal()) : Boolean(meta().email_setup_done);
  }

  // The Google account Gmail should open on (Gmail's "authuser").
  function gmailAccount() {
    if (isDesktop) {
      const saved = readLocal();
      return (saved && saved.profileEmail) || "";
    }
    return meta().school_account || "";
  }

  // The Chrome profile chosen on this computer (desktop app), "" if none.
  function profileDir() {
    const saved = isDesktop ? readLocal() : null;
    return (saved && saved.profileDir) || "";
  }

  // Opens a ready-made email link the way the student set up.
  function openEmail(url) {
    if (isDesktop) {
      const saved = readLocal();
      window.desktop.openEmail(url, (saved && saved.profileDir) || "");
    } else {
      window.open(url, "_blank");
    }
  }

  // ---------- The page ----------

  function setMessage(text, isError = true) {
    const el = $("email-setup-message");
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(text) && isError);
    el.classList.toggle("success", Boolean(text) && !isError);
  }

  function savedProvider() {
    try {
      return localStorage.getItem(PROVIDER_KEY) || meta().mail_provider || "gmail";
    } catch {
      return meta().mail_provider || "gmail";
    }
  }

  function renderProfiles() {
    const list = $("profile-list");
    const saved = readLocal();
    // Already chosen on this computer? Keep it. Otherwise pick a profile named like "school".
    let selected = saved ? saved.profileDir : null;
    if (selected === null || selected === undefined) {
      const school = profiles.find((p) => /school/i.test(p.name) || /school/i.test(p.email));
      selected = school ? school.dir : null;
    }

    const option = (value, title, detail) => {
      const input = UI.h("input", { type: "radio", name: "chrome-profile", value, checked: value === selected });
      return UI.h("label", { class: "profile-option" + (/school/i.test(title) ? " is-school" : "") },
        input,
        UI.h("span", { class: "profile-avatar", text: (title.trim().charAt(0) || "?").toUpperCase() }),
        UI.h("span", { class: "profile-text" },
          UI.h("strong", { text: title }),
          detail ? UI.h("span", { text: detail }) : null));
    };

    const items = profiles.map((p) => option(p.dir, p.name, p.email || "Chrome profile"));
    if (!chromeInstalled) items.push(UI.h("p", { class: "section-hint", text: "Google Chrome isn't installed on this computer, so emails will open in your default browser." }));
    else if (profiles.length === 0) items.push(UI.h("p", { class: "section-hint", text: "Couldn't find any Chrome profiles. Emails will open in your default browser." }));
    items.push(option("", "Don't use Chrome", "Open emails in my default browser instead"));
    if (!chromeInstalled || profiles.length === 0) selected = selected || "";
    list.replaceChildren(...items);
    if (selected === "") list.querySelector('input[value=""]').checked = true;
  }

  function renderAccount() {
    $("account-section").hidden = isDesktop || $("setup-provider").value !== "gmail";
    if (!$("school-account").value) $("school-account").value = meta().school_account || "";
    $("one-account").checked = Boolean(meta().email_setup_done) && !meta().school_account;
  }

  async function enter() {
    const firstTime = !isDone();
    $("email-setup-intro").hidden = !firstTime;
    $("email-setup-header").hidden = firstTime;
    $("email-setup-save").textContent = firstTime ? "Save & continue" : "Save";
    $("setup-provider").value = savedProvider();
    setMessage("");
    renderAccount();
    $("profile-section").hidden = !isDesktop;
    if (isDesktop) {
      const result = await window.desktop.chromeProfiles();
      chromeInstalled = result.installed;
      profiles = result.profiles;
      renderProfiles();
    }
  }

  $("setup-provider").addEventListener("change", renderAccount);
  $("school-account").addEventListener("input", () => {
    if ($("school-account").value.trim()) $("one-account").checked = false;
  });
  $("one-account").addEventListener("change", () => {
    if ($("one-account").checked) $("school-account").value = "";
  });

  async function save() {
    const provider = $("setup-provider").value;
    const updates = { mail_provider: provider };

    if (isDesktop) {
      const picked = document.querySelector('input[name="chrome-profile"]:checked');
      if (!picked) return setMessage("Pick the Chrome profile to use (your school one), or \"Don't use Chrome\".");
      const profile = profiles.find((p) => p.dir === picked.value);
      writeLocal({ profileDir: picked.value, profileName: profile ? profile.name : "", profileEmail: profile ? profile.email : "" });
    } else {
      const account = $("school-account").value.trim();
      if (provider === "gmail" && !account && !$("one-account").checked) {
        return setMessage("Type your school email, or tick \"I only use one Google account\".");
      }
      if (account && !/^\S+@\S+\.\S+$/.test(account)) return setMessage("That doesn't look like an email address.");
      updates.school_account = provider === "gmail" ? account : meta().school_account || "";
      updates.email_setup_done = true;
    }

    try {
      localStorage.setItem(PROVIDER_KEY, provider);
    } catch {
      // The account copy below is enough.
    }
    const button = $("email-setup-save");
    button.disabled = true;
    const { data, error } = await db.auth.updateUser({ data: updates });
    button.disabled = false;
    if (error) return setMessage(`Couldn't save: ${friendlyError(error)}`);
    if (data && data.user) currentUser = data.user;
    // Keep the email-service menus on the other pages in step.
    document.querySelectorAll("#mail-provider, #quick-provider").forEach((select) => (select.value = provider));
    location.hash = "#home";
    showView();
  }

  $("email-setup-save").addEventListener("click", save);

  return { isDone, gmailAccount, openEmail, enter, profileDir };
})();
