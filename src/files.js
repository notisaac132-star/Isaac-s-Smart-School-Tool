// PDF helpers for Quick submit: drop handling, opening the email, and the list of PDFs shared as
// download links by older versions of the app (so those links can still be stopped). New submissions
// are always attachments (see quick.js and gmail.js); nothing is uploaded any more.
window.PdfShare = (function () {
  const BUCKET = "school-files";
  const MAX_BYTES = 10 * 1024 * 1024;

  const $ = (id) => document.getElementById(id);

  function formatSize(bytes) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  const isPdf = (file) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

  // "1697040000000-ab12-My-Worksheet.pdf" -> "My-Worksheet.pdf"
  const displayName = (key) => key.replace(/^\d+-[a-z0-9]{4}-/, "");

  // A file dropped outside the drop box would make the window open the PDF instead of the app; on the
  // Quick submit page treat it as a drop on the box, and everywhere else just ignore it.
  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!event.dataTransfer || !event.dataTransfer.files.length) return;
    if (location.hash === "#quick" && window.QuickSubmit) window.QuickSubmit.take(event.dataTransfer.files);
  });

  // In a browser (Chromebook version), open the email tab during the click so it isn't blocked as a
  // pop-up later. The desktop app opens links in the chosen Chrome profile instead.
  function openEmailTab(provider) {
    return !window.desktop && provider !== "mailto" ? window.open("", "_blank") : null;
  }

  function showEmail(tab, url) {
    if (tab && !tab.closed) tab.location.href = url;
    else window.EmailSetup.openEmail(url);
  }

  // ---------- Older shared links ----------

  async function loadShared() {
    if (!db || !currentUser) return;
    const section = $("shared-section");
    const list = $("shared-files");
    const { data, error } = await db.storage.from(BUCKET).list(currentUser.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    const files = error ? [] : (data || []).filter((f) => f.name && f.id !== null);
    section.hidden = files.length === 0;
    list.replaceChildren(...files.map((file) => {
      const path = `${currentUser.id}/${file.name}`;
      const name = displayName(file.name);
      const when = file.created_at ? new Date(file.created_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
      const stop = UI.h("button", { type: "button", class: "remove-btn", text: "Stop sharing" });
      stop.addEventListener("click", async () => {
        if (!confirm(`Stop sharing ${name}? Its download link will stop working.`)) return;
        stop.disabled = true;
        const { error: removeError } = await db.storage.from(BUCKET).remove([path]);
        if (removeError) {
          stop.disabled = false;
          return;
        }
        loadShared();
      });
      const size = file.metadata && file.metadata.size ? ` · ${formatSize(file.metadata.size)}` : "";
      return UI.h("li", {},
        UI.h("div", { class: "session-info" },
          UI.h("div", { class: "session-title", text: `📄 ${name}` }),
          UI.h("div", { class: "session-meta", text: `${when}${size}` })),
        UI.h("div", { class: "shared-actions" }, stop));
    }));
  }

  return { loadShared, isPdf, formatSize, MAX_BYTES, openEmailTab, showEmail };
})();
