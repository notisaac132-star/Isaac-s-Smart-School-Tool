// Real Gmail attachments. With a Google sign-in (scope: compose drafts), Quick submit makes a Gmail draft
// with the PDF attached and opens it. Needs APP_CONFIG.googleClientId.
//  - Chromebook / web: Google's sign-in pop-up (Google Identity Services).
//  - Desktop app: Google blocks its sign-in inside apps, so the sign-in opens in the student's browser and
//    the app's main process talks to Gmail (google.js, via window.desktop).
window.GmailAttach = (function () {
  const SCOPE = "https://www.googleapis.com/auth/gmail.compose";
  const clientId = (window.APP_CONFIG && window.APP_CONFIG.googleClientId) || "";
  let token = null;
  let tokenExpires = 0;
  let account = "";
  let loading = null;

  const desktop = () => Boolean(window.desktop && window.desktop.googleSignIn);
  const available = () => Boolean(clientId) && (!window.desktop || desktop());

  // Google's sign-in script. Loaded ahead of time: the sign-in pop-up has to open straight from the click.
  function load() {
    if (!available() || desktop()) return Promise.resolve(available());
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve(true);
    if (!loading) {
      loading = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => {
          loading = null;
          resolve(false);
        };
        document.head.append(script);
      });
    }
    return loading;
  }

  const ready = () => Boolean(window.google && window.google.accounts && window.google.accounts.oauth2);
  const hasToken = () => Boolean(token) && Date.now() < tokenExpires - 60000;

  // Must be called straight from a click (before any await), because it may open Google's pop-up.
  function getToken(loginHint, profileDir) {
    if (desktop()) {
      return window.desktop.googleSignIn(clientId, loginHint, profileDir).then(() => {
        token = "desktop"; // the real one stays in the app's main process
        tokenExpires = Date.now() + 50 * 60 * 1000;
        return token;
      }, (error) => {
        // Electron wraps errors from the app's main process: keep just the reason.
        throw new Error(String(error.message).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));
      });
    }
    if (hasToken()) return Promise.resolve(token);
    if (!ready()) return Promise.reject(new Error("Google sign-in didn't load"));
    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        login_hint: loginHint || undefined,
        callback: (response) => {
          if (response.error || !window.google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
            reject(new Error(response.error_description || "Gmail permission wasn't given"));
            return;
          }
          token = response.access_token;
          tokenExpires = Date.now() + Number(response.expires_in || 3600) * 1000;
          resolve(token);
        },
        error_callback: (error) => reject(new Error(error && error.type === "popup_closed" ? "the Google sign-in was closed" : "Google sign-in didn't open")),
      });
      client.requestAccessToken({ prompt: "" });
    });
  }

  // ---------- Building the email ----------

  function base64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  }

  const utf8 = (text) => base64(new TextEncoder().encode(text));
  const wrap = (text) => text.replace(/.{1,76}/g, "$&\r\n");
  const header = (text) => (/^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${utf8(text)}?=`);

  async function buildMessage({ to, subject, body, file }) {
    const boundary = `sst-${crypto.getRandomValues(new Uint32Array(2)).join("")}`;
    const asciiName = file.name.replace(/[^\x20-\x7e]|["\\]/g, "_");
    return [
      `To: ${to.join(", ")}`,
      `Subject: ${header(subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      wrap(utf8(body)),
      `--${boundary}`,
      `Content-Type: application/pdf; name="${asciiName}"`,
      `Content-Disposition: attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap(base64(new Uint8Array(await file.arrayBuffer()))),
      `--${boundary}--`,
      "",
    ].join("\r\n");
  }

  async function gmail(path, options) {
    if (desktop()) {
      const result = await window.desktop.gmailFetch(path, options || {});
      let data = {};
      try {
        data = JSON.parse(result.text || "{}");
      } catch {
        // Not JSON: keep the empty object.
      }
      if (!result.ok) {
        if (result.status === 401) token = null;
        throw new Error((data.error && data.error.message) || `Gmail said no (${result.status})`);
      }
      return data;
    }
    const response = await fetch(`https://gmail.googleapis.com${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...(options && options.headers) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) token = null;
      throw new Error((data.error && data.error.message) || `Gmail said no (${response.status})`);
    }
    return data;
  }

  // Makes the draft (with the PDF attached) and returns the link that opens it in Gmail.
  async function createDraft(email) {
    const draft = await gmail("/upload/gmail/v1/users/me/drafts?uploadType=media", {
      method: "POST",
      headers: { "Content-Type": "message/rfc822" },
      body: await buildMessage(email),
    });
    if (!account) account = (await gmail("/gmail/v1/users/me/profile")).emailAddress || "";
    const user = account ? encodeURIComponent(account) : "0";
    return `https://mail.google.com/mail/u/${user}/#drafts?compose=${draft.message.id}`;
  }

  const cancel = () => (desktop() ? window.desktop.googleCancel() : null);

  return { available, load, hasToken, getToken, createDraft, cancel, desktop };
})();
