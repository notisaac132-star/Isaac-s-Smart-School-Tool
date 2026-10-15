// "Send a PDF": drop PDFs, add a note, pick teachers. The PDFs are uploaded privately to the account
// (Supabase Storage, bucket "school-files", one folder per account) and the email that opens contains
// a download link for each one, because links that open an email can't attach files.
window.FilesPage = (function () {
  const BUCKET = "school-files";
  const MAX_FILES = 5;
  const MAX_BYTES = 10 * 1024 * 1024;
  const LINK_DAYS = 365;

  const $ = (id) => document.getElementById(id);
  const dropZone = $("drop-zone");
  const input = $("file-input");
  let picked = [];

  function setMessage(text, isError = true) {
    const el = $("files-message");
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(text) && isError);
    el.classList.toggle("success", Boolean(text) && !isError);
  }

  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const isPdf = (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  // Storage keys only allow simple characters; the original name is kept for the download.
  function storageName(file) {
    const safe = file.name.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
    return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}.pdf`;
  }

  // "1697040000000-ab12-My-Worksheet.pdf" -> "My-Worksheet.pdf"
  const displayName = (key) => key.replace(/^\d+-[a-z0-9]{4}-/, "");

  // ---------- Picking files ----------

  function addFiles(fileList) {
    const rejected = [];
    for (const file of fileList) {
      if (!isPdf(file)) rejected.push(`${file.name} isn't a PDF`);
      else if (file.size > MAX_BYTES) rejected.push(`${file.name} is over 10 MB`);
      else if (picked.length >= MAX_FILES) rejected.push(`only ${MAX_FILES} PDFs at a time`);
      else if (!picked.some((f) => f.name === file.name && f.size === file.size)) picked.push(file);
    }
    renderPicked();
    setMessage(rejected.length ? `Skipped: ${rejected.join("; ")}.` : "");
  }

  function renderPicked() {
    $("picked-files").replaceChildren(...picked.map((file, i) => UI.h("li", {},
      UI.h("span", { class: "picked-name" }, "📄 ", file.name, UI.h("span", { class: "picked-size", text: ` · ${formatSize(file.size)}` })),
      UI.h("button", {
        type: "button",
        class: "remove-btn",
        text: "Remove",
        onclick: () => {
          picked.splice(i, 1);
          renderPicked();
        },
      }))));
    dropZone.classList.toggle("has-files", picked.length > 0);
  }

  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = "";
  });
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((type) => dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  }));
  ["dragleave", "dragend"].forEach((type) => dropZone.addEventListener(type, () => dropZone.classList.remove("dragging")));
  dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
    addFiles(event.dataTransfer.files);
  });

  // A file dropped anywhere else would make the window open the PDF instead of the app; on this page
  // treat it as a drop on the drop zone, and everywhere else just ignore it.
  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (location.hash === "#files" && event.dataTransfer && event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  });

  // ---------- Who gets it ----------

  function renderRecipients() {
    const people = [...contacts.teachers, ...contacts.tutors];
    const box = $("file-recipients");
    if (people.length === 0) {
      box.replaceChildren(UI.h("p", { class: "section-hint", text: "Add a teacher in Teachers & Tutors first." }));
      return;
    }
    const previouslyChecked = new Set([...box.querySelectorAll("input:checked")].map((el) => el.value));
    const firstTime = box.querySelectorAll("input").length === 0;
    box.replaceChildren(...people.map((person) => UI.h("label", { class: "report-toggle recipient" },
      UI.h("input", {
        type: "checkbox",
        value: person.id,
        checked: firstTime ? person.kind === "teacher" : previouslyChecked.has(person.id),
      }),
      ` ${person.name}`,
      UI.h("span", { class: "picked-size", text: person.kind === "tutor" ? " (tutor)" : "" }))));
  }

  function chosenRecipients() {
    const ids = new Set([...$("file-recipients").querySelectorAll("input:checked")].map((el) => el.value));
    return [...contacts.teachers, ...contacts.tutors].filter((person) => ids.has(person.id));
  }

  // ---------- Sending ----------

  function linkExpiry() {
    const date = new Date();
    date.setDate(date.getDate() + LINK_DAYS);
    return date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }

  async function makeLink(path, name) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, LINK_DAYS * 86400, { download: name });
    if (error) throw error;
    return data.signedUrl;
  }

  function buildEmail(recipients, uploaded, note) {
    const name = (currentUser.user_metadata && currentUser.user_metadata.name) || "";
    const subject = uploaded.length === 1
      ? `${name ? `${name}: ` : ""}${uploaded[0].name}`
      : `School files${name ? ` from ${name}` : ""} (${uploaded.length} PDFs)`;
    const body = [
      `Hi ${joinNames(recipients.map((c) => c.name))},`,
      "",
      ...(note ? [note, ""] : []),
      uploaded.length === 1 ? "Here's the file:" : "Here are the files:",
      ...uploaded.map((file) => `- ${file.name} (${formatSize(file.size)}): ${file.url}`),
      "",
      `(The download ${uploaded.length === 1 ? "link works" : "links work"} until ${linkExpiry()}.)`,
      "",
      "Thanks,",
      name,
    ].join("\n").trimEnd();
    return { to: recipients.map((c) => c.email), subject, body };
  }

  async function send() {
    if (!db || !currentUser) return;
    if (picked.length === 0) return setMessage("Drag in a PDF (or click the box) first.");
    const recipients = chosenRecipients();
    if (recipients.length === 0) return setMessage("Tick at least one teacher to send it to.");

    const button = $("send-files");
    button.disabled = true;
    // In a browser (Chromebook version), open the tab now, while the click still counts as a click, so it
    // isn't blocked as a pop-up after the upload. The desktop app opens links in the normal browser instead.
    const provider = $("file-provider").value;
    const isDesktopApp = /Electron/i.test(navigator.userAgent);
    const tab = !isDesktopApp && provider !== "mailto" ? window.open("", "_blank") : null;
    try {
      const uploaded = [];
      for (const [i, file] of picked.entries()) {
        setMessage(`Uploading ${i + 1} of ${picked.length}: ${file.name}…`, false);
        const path = `${currentUser.id}/${storageName(file)}`;
        const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
        if (error) throw error;
        uploaded.push({ name: file.name, size: file.size, url: await makeLink(path, file.name) });
      }
      const url = composeUrl(provider, buildEmail(recipients, uploaded, $("file-note").value.trim()));
      if (tab && !tab.closed) tab.location.href = url;
      else window.open(url, "_blank");
      setMessage(`Uploaded ${plural(uploaded.length, "PDF")}. Your email is open: check it and press Send.`, false);
      picked = [];
      renderPicked();
      $("file-note").value = "";
      loadShared();
    } catch (error) {
      if (tab && !tab.closed) tab.close();
      setMessage(/bucket not found|not found/i.test(error.message || "")
        ? "Sending PDFs isn't switched on yet (the files storage hasn't been set up)."
        : `Couldn't upload: ${friendlyError(error)}`);
    } finally {
      button.disabled = false;
    }
  }

  $("send-files").addEventListener("click", send);

  // ---------- Files you've shared ----------

  async function loadShared() {
    if (!db || !currentUser) return;
    const list = $("shared-files");
    const { data, error } = await db.storage.from(BUCKET).list(currentUser.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      list.replaceChildren(UI.h("li", { class: "empty", text: "Couldn't load your shared files." }));
      return;
    }
    const files = (data || []).filter((f) => f.name && f.id !== null);
    $("files-summary").textContent = files.length ? `${plural(files.length, "file")} shared` : "Drag and drop a PDF to send it";
    if (window.ConsoleHome) window.ConsoleHome.refresh();
    if (files.length === 0) {
      list.replaceChildren(UI.h("li", { class: "empty", text: "Nothing shared yet." }));
      return;
    }
    list.replaceChildren(...files.map((file) => {
      const path = `${currentUser.id}/${file.name}`;
      const name = displayName(file.name);
      const when = file.created_at ? new Date(file.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
      const copy = UI.h("button", { type: "button", class: "chip-btn", text: "Copy link" });
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(await makeLink(path, name));
          copy.textContent = "Copied!";
        } catch {
          copy.textContent = "Couldn't copy";
        }
        setTimeout(() => (copy.textContent = "Copy link"), 1500);
      });
      const stop = UI.h("button", { type: "button", class: "remove-btn", text: "Stop sharing" });
      stop.addEventListener("click", async () => {
        if (!confirm(`Stop sharing ${name}? Its download link will stop working.`)) return;
        stop.disabled = true;
        const { error: removeError } = await db.storage.from(BUCKET).remove([path]);
        if (removeError) {
          stop.disabled = false;
          setMessage(`Couldn't remove it: ${friendlyError(removeError)}`);
          return;
        }
        loadShared();
      });
      const size = file.metadata && file.metadata.size ? ` · ${formatSize(file.metadata.size)}` : "";
      return UI.h("li", {},
        UI.h("div", { class: "session-info" },
          UI.h("div", { class: "session-title", text: `📄 ${name}` }),
          UI.h("div", { class: "session-meta", text: `${when}${size}` })),
        UI.h("div", { class: "shared-actions" }, copy, stop));
    }));
  }

  // ---------- Page setup ----------

  function loadProvider() {
    try {
      const saved = localStorage.getItem(PROVIDER_KEY);
      if (saved) $("file-provider").value = saved;
    } catch {
      // Not remembering the choice is fine.
    }
  }
  $("file-provider").addEventListener("change", () => {
    try {
      localStorage.setItem(PROVIDER_KEY, $("file-provider").value);
    } catch {
      // Not remembering the choice is fine.
    }
  });

  // Called by app.js whenever the Send a PDF page is shown.
  function enter() {
    loadProvider();
    renderRecipients();
    loadShared();
  }

  return { enter, loadShared };
})();
