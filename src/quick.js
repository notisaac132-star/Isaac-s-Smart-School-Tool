// Quick submit: drop one assignment PDF, pick a teacher, type (or keep) the assignment name, Submit.
// With Gmail + Google sign-in (gmail.js) the PDF is attached to a Gmail draft; otherwise it's uploaded
// privately and the email gets a short download link (files.js). Preset email:
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

  function buildEmail(teacher, assignment, uploaded) {
    const name = studentName();
    const lines = [`Hi ${teacher.name},`, "", `I've submitted my assignment: ${assignment}`, ""];
    if (uploaded) lines.push(`📎 ${uploaded.name} (${files().formatSize(uploaded.size)})`, uploaded.url, "");
    else lines.push("It's attached to this email.", "");
    lines.push("Thanks,", name === "A student" ? "" : name, "", "Sent with Smart School Tool");
    return { to: [teacher.email], subject: subjectFor(assignment), body: lines.join("\n") };
  }

  function done(teacher, text) {
    setMessage(text || `Your email to ${teacher.name} is open: press Send to hand it in.`, false);
    file = null;
    $("quick-name").value = "";
    nameWasAutoFilled = false;
    render();
  }

  // After a wait the browser may block a new tab, so if it does, offer a button to open the email instead.
  function openOrOffer(tab, url, teacher) {
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

  // Gmail with Google sign-in (Chromebook / web): a Gmail draft with the PDF really attached.
  async function submitAttached(teacher, assignment) {
    const gmail = window.GmailAttach;
    const signedIn = gmail.hasToken();
    const tab = signedIn ? window.open("", "_blank") : null;
    const sending = file;
    try {
      // Opens Google's sign-in pop-up the first time; it has to start before any other waiting.
      const asking = gmail.getToken(window.EmailSetup.gmailAccount());
      setMessage(signedIn ? `Attaching ${sending.name}…` : "Sign in with Google to attach your PDF…", false);
      await asking;
      setMessage(`Attaching ${sending.name}…`, false);
      const url = await gmail.createDraft({ ...buildEmail(teacher, assignment, null), file: sending });
      done(teacher, `Attached! Your email to ${teacher.name} is open in Gmail: press Send to hand it in.`);
      openOrOffer(tab, url, teacher);
      return "";
    } catch (error) {
      if (tab && !tab.closed) tab.close();
      setMessage(`Couldn't attach it in Gmail (${error.message}), so the email gets a download link instead…`, false);
      return `Gmail couldn't attach it (${error.message}), so your email has a download link instead. `;
    }
  }

  async function submitWithLink(teacher, assignment, provider, tab, note = "") {
    try {
      setMessage(`Uploading ${file.name}…`, false);
      const uploaded = await files().uploadPdf(file);
      const url = composeUrl(provider, buildEmail(teacher, assignment, uploaded));
      done(teacher, `${note}Uploaded! Your email to ${teacher.name} is open: press Send to hand it in.`);
      if (window.desktop || provider === "mailto") files().showEmail(tab, url);
      else openOrOffer(tab, url, teacher);
      files().loadShared();
    } catch (error) {
      if (tab && !tab.closed) tab.close();
      setMessage(files().uploadErrorMessage(error));
    }
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
    const provider = $("quick-provider").value;
    try {
      if (provider === "gmail" && window.GmailAttach && window.GmailAttach.enabled()) {
        const problem = await submitAttached(teacher, assignment);
        if (problem) await submitWithLink(teacher, assignment, provider, null, problem);
      } else {
        await submitWithLink(teacher, assignment, provider, files().openEmailTab(provider));
      }
    } finally {
      button.disabled = false;
    }
  }

  $("quick-submit").addEventListener("click", submit);

  // ---------- Page setup ----------

  $("quick-provider").addEventListener("change", () => {
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
    files().loadShared();
    if (window.GmailAttach && window.GmailAttach.enabled()) window.GmailAttach.load();
  }

  return { enter, take };
})();
