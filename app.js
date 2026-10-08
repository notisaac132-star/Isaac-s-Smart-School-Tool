// Contacts are stored in the browser's localStorage so they stay after a refresh.
const STORAGE_KEY = "smartSchoolTool.contacts";

function loadContacts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.teachers) && Array.isArray(saved.tutors)) {
      return saved;
    }
  } catch (e) {
    // Fall through to an empty list if storage is unavailable or corrupted.
  }
  return { teachers: [], tutors: [] };
}

function saveContacts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch (e) {
    console.warn("Could not save contacts:", e);
  }
}

const contacts = loadContacts();

function render(kind) {
  const list = document.getElementById(`${kind}-list`);
  list.replaceChildren();

  if (contacts[kind].length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = kind === "teachers" ? "No teachers added yet." : "No tutors added yet.";
    list.append(empty);
    return;
  }

  contacts[kind].forEach((contact) => {
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
    remove.addEventListener("click", () => {
      contacts[kind] = contacts[kind].filter((c) => c.id !== contact.id);
      saveContacts();
      render(kind);
    });

    item.append(info, remove);
    list.append(item);
  });
}

document.querySelectorAll(".contact-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const kind = form.dataset.kind;
    const data = new FormData(form);

    contacts[kind].push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name: data.get("name").trim(),
      subject: data.get("subject").trim(),
      email: data.get("email").trim(),
    });
    saveContacts();
    render(kind);
    form.reset();
    form.querySelector("input").focus();
  });
});

render("teachers");
render("tutors");
