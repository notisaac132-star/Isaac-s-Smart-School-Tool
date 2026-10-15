// Desktop app only (main process): Google sign-in for attaching PDFs to Gmail drafts.
// Google doesn't allow its sign-in inside apps like this one, so it happens in the student's own browser
// (their chosen Chrome profile): Google sends the browser back to http://localhost:53682/, where this file
// is briefly listening, and the page there hands the sign-in back to the app. The token never leaves the
// main process; the page asks main to talk to Gmail for it (gmailFetch).
const crypto = require("crypto");
const http = require("http");
const { net } = require("electron");

const PORT = 53682;
const REDIRECT_URI = `http://localhost:${PORT}/`;
const SCOPE = "https://www.googleapis.com/auth/gmail.compose";
const TIMEOUT_MS = 2 * 60 * 1000;

let cached = null; // { token, expires }
let pending = null; // { promise, cancel }

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Smart School Tool</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0e16;color:#e8ebf3;
font:16px system-ui,sans-serif;text-align:center}p{color:#98a1b7}</style></head>
<body><div><h1 id="t">Connecting…</h1><p id="p"></p></div><script>
fetch("/done", { method: "POST", body: location.hash.slice(1) }).then(function () {
  var ok = !/(^|&)error=/.test(location.hash.slice(1));
  document.getElementById("t").textContent = ok ? "All set!" : "Gmail wasn't connected";
  document.getElementById("p").textContent = "You can close this tab and go back to Smart School Tool.";
  setTimeout(function () { window.close(); }, 800);
});
</script></body></html>`;

const hasToken = () => Boolean(cached) && Date.now() < cached.expires - 60000;

// Resolves once the student has signed in in their browser. `open` opens a link in their browser.
function getToken({ clientId, loginHint, open }) {
  if (hasToken()) return Promise.resolve(true);
  if (pending) return pending.promise;
  if (!/^[\w-]+\.apps\.googleusercontent\.com$/.test(String(clientId))) return Promise.reject(new Error("Google sign-in isn't set up"));

  let cancel;
  const promise = new Promise((resolve, reject) => {
    const state = crypto.randomBytes(16).toString("hex");
    const servers = [];
    let done = false;
    let listening = 0;
    let failed = 0;

    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      servers.forEach((server) => server.close());
      pending = null;
      if (error) reject(error);
      else resolve(true);
    };
    cancel = () => finish(new Error("the Google sign-in was cancelled"));
    const timer = setTimeout(() => finish(new Error("the Google sign-in wasn't finished in time")), TIMEOUT_MS);

    const handle = (req, res) => {
      const route = req.url.split("?")[0];
      if (req.method === "GET" && route === "/") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(PAGE);
        return;
      }
      if (req.method === "POST" && route === "/done") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
          if (body.length > 20000) req.destroy();
        });
        // Answer the page first, then act (closing the listener too soon would cut the page off).
        req.on("end", () => res.writeHead(204).end(() => {
          const answer = new URLSearchParams(body);
          if (answer.get("state") !== state) return; // not from our sign-in
          if (answer.get("error")) {
            finish(new Error(answer.get("error") === "access_denied" ? "Gmail permission wasn't given" : answer.get("error")));
            return;
          }
          const token = answer.get("access_token");
          if (!token || !(answer.get("scope") || "").split(" ").includes(SCOPE)) {
            finish(new Error("Gmail permission wasn't given"));
            return;
          }
          cached = { token, expires: Date.now() + Number(answer.get("expires_in") || 3600) * 1000 };
          finish(null);
        }));
        return;
      }
      res.writeHead(404);
      res.end();
    };

    const url = "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "token",
      scope: SCOPE,
      state,
      include_granted_scopes: "true",
      ...(loginHint ? { login_hint: loginHint } : {}),
    });

    // "localhost" can mean either of these, so listen on both (only on this computer, never the network).
    for (const host of ["127.0.0.1", "::1"]) {
      const server = http.createServer(handle);
      servers.push(server);
      server.on("error", () => {
        failed += 1;
        if (failed === 2) finish(new Error("couldn't start the Google sign-in (is another copy of the app open?)"));
      });
      server.listen(PORT, host, () => {
        listening += 1;
        if (listening === 1) open(url);
      });
    }
  });
  pending = { promise, cancel };
  return promise;
}

function cancelSignIn() {
  if (pending) pending.cancel();
}

// Calls the Gmail API for the page with the saved sign-in. Only Gmail's own "me" addresses are allowed.
async function gmailFetch(pathname, { method = "GET", headers = {}, body } = {}) {
  if (!/^\/(upload\/)?gmail\/v1\/users\/me\/[\w/?=&.-]+$/.test(String(pathname))) throw new Error("Not a Gmail address");
  if (!hasToken()) return { ok: false, status: 401, text: JSON.stringify({ error: { message: "not signed in" } }) };
  const response = await net.fetch(`https://gmail.googleapis.com${pathname}`, {
    method,
    headers: { ...headers, Authorization: `Bearer ${cached.token}` },
    body,
  });
  if (response.status === 401) cached = null;
  return { ok: response.ok, status: response.status, text: await response.text() };
}

module.exports = { getToken, cancelSignIn, gmailFetch, hasToken, REDIRECT_URI };
