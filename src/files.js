// PDF uploads for Quick submit. The PDF is uploaded privately to the account (Supabase Storage, bucket
// "school-files", one folder per account) and the email that opens contains a download link, because
// links that open an email can't attach files. Also shows the "Files you've shared" list.
window.PdfShare = (function () {
  const BUCKET = "school-files";
  const MAX_BYTES = 10 * 1024 * 1024;
  const LINK_DAYS = 365;

  const $ = (id) => document.getElementById(id);

  function setMessage(text) {
    const el = $("quick-message");
    el.textContent = text || "";
    el.classList.toggle("error", Boolean(text));
    el.classList.remove("success");
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

  // A file dropped outside the drop box would make the window open the PDF instead of the app; on the
  // Quick submit page treat it as a drop on the box, and everywhere else just ignore it.
  document.addEventListener("dragover", (event) => event.preventDefault());
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!event.dataTransfer || !event.dataTransfer.files.length) return;
    if (location.hash === "#quick" && window.QuickSubmit) window.QuickSubmit.take(event.dataTransfer.files);
  });

  // ---------- Uploading ----------

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

  // Uploads one PDF to the account's folder and returns its name, size and a download link.
  async function uploadPdf(file) {
    const path = `${currentUser.id}/${storageName(file)}`;
    const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf", upsert: false });
    if (error) throw error;
    return { name: file.name, size: file.size, url: await makeLink(path, file.name) };
  }

  // In a browser (Chromebook version), open the email tab during the click so it isn't blocked as a
  // pop-up after the upload finishes. The desktop app opens links in the normal browser instead.
  function openEmailTab(provider) {
    return !window.desktop && provider !== "mailto" ? window.open("", "_blank") : null;
  }

  // Desktop app: opens in the Chrome profile chosen in Email setup.
  function showEmail(tab, url) {
    if (tab && !tab.closed) tab.location.href = url;
    else window.EmailSetup.openEmail(url);
  }

  function uploadErrorMessage(error) {
    return /bucket not found|not found/i.test((error && error.message) || "")
      ? "Sending PDFs isn't switched on yet (the files storage hasn't been set up)."
      : `Couldn't upload: ${friendlyError(error)}`;
  }

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

  return { loadShared, isPdf, formatSize, MAX_BYTES, linkExpiry, uploadPdf, openEmailTab, showEmail, uploadErrorMessage };
})();
