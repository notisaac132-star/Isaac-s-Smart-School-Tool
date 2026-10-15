// Quick submit: drop one assignment PDF, pick a teacher, type (or keep) the assignment name, Submit.
// The PDF is uploaded privately and the email gets a download link (files.js), with a preset email:
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
    const body = [
      `Hi ${teacher.name},`,
      "",
      `I've submitted my assignment: ${assignment}`,
      "",
      `Download it here (${uploaded.name}, ${files().formatSize(uploaded.size)}):`,
      uploaded.url,
      "",
      `(The link works until ${files().linkExpiry()}.)`,
      "",
      "Thanks,",
      name === "A student" ? "" : name,
      "",
      "Sent with Smart School Tool",
    ].join("\n");
    return { to: [teacher.email], subject: subjectFor(assignment), body };
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
    const tab = files().openEmailTab(provider);
    try {
      setMessage(`Uploading ${file.name}…`, false);
      const uploaded = await files().uploadPdf(file);
      files().showEmail(tab, composeUrl(provider, buildEmail(teacher, assignment, uploaded)));
      setMessage(`Uploaded! Your email to ${teacher.name} is open: press Send to hand it in.`, false);
      file = null;
      $("quick-name").value = "";
      nameWasAutoFilled = false;
      render();
      files().loadShared();
    } catch (error) {
      if (tab && !tab.closed) tab.close();
      setMessage(files().uploadErrorMessage(error));
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
  }

  return { enter, take };
})();
