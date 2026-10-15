// Quick submit: drop one assignment PDF, pick a teacher, type (or keep) the assignment name, Submit.
// The PDF always goes in as an attachment (no links: school networks can block them). With Gmail on
// Chromebook / web it's attached for you (gmail.js); otherwise the email opens and you attach it.
// Preset email:
// subject "SMART SCHOOL TOOL: <student> Submitted An Assignment: <assignment>".
window.QuickSubmit = (function () {
  const TEACHER_KEY = "smartSchoolTool.quickTeacher";
  const $ = (id) => document.getElementById(id);
  const files = () => window.PdfShare;
  let file = null;
  let nameWasAutoFilled = false;

  function setMessage(text, isError = true) {
    const el = $("quick-message");
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(text) && isError);
    el.classList.toggle("success", Boolean(text) && !isError);
  }

  function studentName() {
    return (currentUser && currentUser.user_metadata && currentUser.user_metadata.name) || "A student";
  }

  function subjectFor(assignment) {
    return `SMART SCHOOL TOOL: ${studentName()} Submitted An Assignment: ${assignment}`;
  }

  // "worksheet_4-final.pdf" -> "worksheet 4 final"
  function nameFromFile(name) {
    return name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  }

  // ---------- The PDF ----------

  function take(fileList) {
    const pdf = [...fileList].find((f) => files().isPdf(f));
    if (!pdf) return setMessage("That isn't a PDF. Drop a .pdf file.");
    if (pdf.size > files().MAX_BYTES) return setMessage(`${pdf.name} is over 10 MB.`);
    file = pdf;
    if (!$("quick-name").value.trim() || nameWasAutoFilled) {
      $("quick-name").value = nameFromFile(pdf.name);
      nameWasAutoFilled = true;
    }
    setMessage("");
    render();
  }

  function render() {
    const zone = $("quick-drop");
    zone.classList.toggle("has-files", Boolean(file));
    $("quick-drop-title").textContent = file ? `📄 ${file.name}` : "Drop your assignment PDF here";
    $("quick-drop-hint").textContent = file ? `${files().formatSize(file.size)} · drop another PDF or click to change it` : "or click to choose it · 10 MB max";

    const teacher = chosenTeacher();
    const assignment = $("quick-name").value.trim() || "…";
    $("quick-preview").textContent = teacher
      ? `Email to ${teacher.name}: "${subjectFor(assignment)}"`
      : "";
  }

  const input = $("quick-input");
  const zone = $("quick-drop");
  input.addEventListener("change", () => {
    take(input.files);
    input.value = "";
  });
  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      input.click();
    }
  });
  ["dragenter", "dragover"].forEach((type) => zone.addEventListener(type, (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  }));
  ["dragleave", "dragend"].forEach((type) => zone.addEventListener(type, () => zone.classList.remove("dragging")));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove("dragging");
    take(event.dataTransfer.files);
  });
  $("quick-name").addEventListener("input", () => {
    nameWasAutoFilled = false;
    render();
  });

  // ---------- The teacher ----------

  function people() {
    return [...contacts.teachers, ...contacts.tutors];
  }

  function chosenTeacher() {
    return people().find((p) => p.id === $("quick-teacher").value) || null;
  }

  function renderTeachers() {
    const select = $("quick-teacher");
    let remembered = select.value;
    if (!remembered) {
      try {
        remembered = localStorage.getItem(TEACHER_KEY) || "";
      } catch {
        remembered = "";
      }
    }
    const list = people();
    select.replaceChildren(...list.map((p) => UI.h("option", { value: p.id, text: p.kind === "tutor" ? `${p.name} (tutor)` : p.name })));
    if (list.length === 0) select.append(UI.h("option", { value: "", text: "Add a teacher first" }));
    if (list.some((p) => p.id === remembered)) select.value = remembered;
  }

  $("quick-teacher").addEventListener("change", () => {
    try {
      localStorage.setItem(TEACHER_KEY, $("quick-teacher").value);
    } catch {
      // Not remembering the choice is fine.
    }
    render();
  });

  // ---------- Submit ----------

  function buildEmail(teacher, assignment) {
    const name = studentName();
    const body = [
      `Hi ${teacher.name},`,
      "",
      `I've submitted my assignment: ${assignment}`,
      "It's attached to this email.",
      "",
      "Thanks,",
      name === "A student" ? "" : name,
      "",
      "Sent with Smart School Tool",
    ].join("\n");
    return { to: [teacher.email], subject: subjectFor(assignment), body };
  }

  // Gmail attaches the PDF by itself (once Google sign-in is set up); everywhere else the student adds it.
  const autoAttach = (provider) => provider === "gmail" && Boolean(window.GmailAttach && window.GmailAttach.available());

  function renderHint() {
    $("quick-hint").textContent = autoAttach($("quick-provider").value)
      ? "Your PDF is attached to the email for you (the first time, Google asks you to sign in)."
      : window.desktop
        ? "Your email opens, then you drag your PDF into it from here to attach it."
        : "Your email opens, then you attach your PDF to it (or pick Gmail to have it attached for you).";
  }

  function reset() {
    file = null;
    $("quick-name").value = "";
    nameWasAutoFilled = false;
    render();
  }

  // After a wait the browser may block a new tab, so if it does, offer a button to open the email instead.
  function openOrOffer(tab, url) {
    if (window.desktop) {
      window.EmailSetup.openEmail(url); // in the chosen Chrome profile
      return;
    }
    if (tab && !tab.closed) {
      tab.location.href = url;
      return;
    }
    if (window.open(url, "_blank")) return;
    const open = UI.h("button", { type: "button", class: "quick-btn open-email-btn", text: "✉ Open the email" });
    open.addEventListener("click", () => {
      window.open(url, "_blank");
      open.remove();
    });
    $("quick-message").append(" ", open);
  }

  // Gmail with Google sign-in: a Gmail draft with the PDF really attached.
  // Returns "" when done, or what went wrong.
  async function submitAttached(teacher, assignment) {
    const gmail = window.GmailAttach;
    const signedIn = gmail.hasToken();
    const tab = signedIn && !window.desktop ? window.open("", "_blank") : null;
    const sending = file;
    try {
      // Opens Google's sign-in the first time; on the web it has to start before any other waiting.
      const asking = gmail.getToken(window.EmailSetup.gmailAccount(), window.EmailSetup.profileDir());
      if (signedIn) setMessage(`Attaching ${sending.name}…`, false);
      else if (gmail.desktop()) {
        setMessage("Sign in with Google in the browser tab that just opened, then come back here…", false);
        const cancel = UI.h("button", { type: "button", class: "ghost-btn", text: "Cancel" });
        cancel.addEventListener("click", () => gmail.cancel());
        $("quick-message").append(" ", cancel);
      } else setMessage("Sign in with Google to attach your PDF…", false);
      await asking;
      setMessage(`Attaching ${sending.name}…`, false);
      const url = await gmail.createDraft({ ...buildEmail(teacher, assignment), file: sending });
      setMessage(`Attached! Your email to ${teacher.name} is open in Gmail: press Send to hand it in.`, false);
      reset();
      openOrOffer(tab, url);
      return "";
    } catch (error) {
      if (tab && !tab.closed) tab.close();
      return `Gmail couldn't attach it by itself (${error.message}). `;
    }
  }

  // Desktop app: the PDF as a file you can drag straight into the email.
  async function dragChip(pdf) {
    const path = await window.desktop.savePdf(pdf.name, await pdf.arrayBuffer());
    const chip = UI.h("div", { class: "drag-chip", draggable: "true", title: "Drag this into your email" },
      UI.h("span", { class: "drag-chip-icon", text: "📄" }),
      UI.h("span", { class: "drag-chip-text" },
        UI.h("strong", { text: pdf.name }),
        UI.h("span", { text: "Grab me" })));
    chip.addEventListener("dragstart", (event) => {
      event.preventDefault();
      window.desktop.dragFile(path);
    });
    // The email window sits on the right half of the screen, so the arrow points at it.
    const arrow = UI.h("div", { class: "drag-arrow", "aria-hidden": "true" });
    arrow.innerHTML = '<svg viewBox="0 0 220 48"><path d="M6 24h196M178 8l24 16-24 16"/></svg>';
    return UI.h("div", { class: "drag-guide" },
      chip,
      UI.h("div", { class: "drag-arrow-wrap" }, arrow, UI.h("strong", { class: "drag-arrow-text", text: "drag and drop to this window!" })));
  }

  // Fills the app's window with the PDF and the arrow until the student says they've sent it.
  function showDragOverlay(guide, teacher, note) {
    const overlay = $("drag-overlay");
    const close = (sent) => {
      overlay.hidden = true;
      overlay.replaceChildren();
      document.removeEventListener("keydown", onKey);
      if (sent) setMessage(`Handed in! Your assignment went to ${teacher.name}.`, false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") close(false);
    };
    const sent = UI.h("button", { type: "button", class: "quick-btn drag-done", text: "✓ I sent it" });
    sent.addEventListener("click", () => close(true));
    const later = UI.h("button", { type: "button", class: "ghost-btn", text: "Close" });
    later.addEventListener("click", () => close(false));
    overlay.replaceChildren(
      UI.h("div", { class: "drag-overlay-inner" },
        UI.h("h2", { text: `Attach it to your email to ${teacher.name}` }),
        note ? UI.h("p", { class: "drag-overlay-note", text: note.trim() }) : null,
        guide,
        UI.h("p", { class: "drag-overlay-hint", text: "Then press Send in the email and come back here." }),
        UI.h("div", { class: "drag-overlay-actions" }, sent, later)));
    overlay.hidden = false;
    document.addEventListener("keydown", onKey);
    sent.focus();
  }

  // Opens the email ready to send, and the student attaches the PDF.
  async function submitAttachYourself(teacher, assignment, provider, tab, note = "") {
    const pdf = file;
    const url = composeUrl(provider, buildEmail(teacher, assignment));
    const box = $("attach-box");
    if (window.desktop) {
      // The email gets its own window on the right half of the screen; the app moves to the left half.
      const guide = await dragChip(pdf);
      if (!(window.desktop.openEmailSplit && (await window.desktop.openEmailSplit(url, window.EmailSetup.profileDir())))) {
        files().showEmail(tab, url);
      }
      setMessage(`${note}Your email to ${teacher.name} is open on the right. Drag your PDF into it, then press Send.`, false);
      box.replaceChildren();
      showDragOverlay(guide, teacher, note);
    } else {
      setMessage(`${note}Your email to ${teacher.name} is open. Attach ${pdf.name} to it (📎, or drag it in from your Files app), then press Send.`, false);
      box.replaceChildren();
      if (provider === "mailto") files().showEmail(tab, url);
      else openOrOffer(tab, url);
    }
    box.hidden = box.childElementCount === 0;
    reset();
    if (!box.hidden) box.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  async function submit() {
    if (!db || !currentUser) return;
    if (!file) return setMessage("Drop your assignment PDF first.");
    const assignment = $("quick-name").value.trim();
    if (!assignment) return setMessage("Type the assignment's name.");
    const teacher = chosenTeacher();
    if (!teacher) return setMessage("Add a teacher in Teachers & Tutors first.");

    const button = $("quick-submit");
    button.disabled = true;
    $("attach-box").hidden = true;
    const provider = $("quick-provider").value;
    try {
      if (autoAttach(provider)) {
        const pdf = file;
        const problem = await submitAttached(teacher, assignment);
        if (problem) {
          file = pdf;
          await submitAttachYourself(teacher, assignment, provider, null, problem);
        }
      } else {
        await submitAttachYourself(teacher, assignment, provider, files().openEmailTab(provider));
      }
    } catch (error) {
      setMessage(`Something went wrong: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  $("quick-submit").addEventListener("click", submit);

  // ---------- Page setup ----------

  $("quick-provider").addEventListener("change", () => {
    renderHint();
    try {
      localStorage.setItem(PROVIDER_KEY, $("quick-provider").value);
    } catch {
      // Not remembering the choice is fine.
    }
  });

  // Called by app.js whenever the Quick submit page is shown.
  function enter() {
    try {
      const saved = localStorage.getItem(PROVIDER_KEY);
      if (saved) $("quick-provider").value = saved;
    } catch {
      // Not remembering the choice is fine.
    }
    renderTeachers();
    render();
    renderHint();
    files().loadShared();
    if (window.GmailAttach && window.GmailAttach.available()) window.GmailAttach.load();
  }

  return { enter, take };
})();
