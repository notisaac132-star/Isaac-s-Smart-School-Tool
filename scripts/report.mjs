// Builds the weekly study report email for one student. Pure functions, no network.

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function formatMinutes(total) {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

function formatDay(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * @param {object} args
 * @param {string} args.studentName
 * @param {string} args.studentEmail
 * @param {string} args.teacherName
 * @param {{subject: string, minutes: number, studied_on: string, notes: string}[]} args.sessions
 */
export function buildReport({ studentName, studentEmail, teacherName, sessions }) {
  const sorted = [...sessions].sort((a, b) => a.studied_on.localeCompare(b.studied_on));
  const total = sorted.reduce((sum, s) => sum + s.minutes, 0);
  const bySubject = new Map();
  for (const s of sorted) bySubject.set(s.subject, (bySubject.get(s.subject) || 0) + s.minutes);
  const subjects = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
  const first = formatDay(sorted[0].studied_on);
  const last = formatDay(sorted[sorted.length - 1].studied_on);
  const range = first === last ? first : `${first} – ${last}`;
  const who = studentName || studentEmail;

  const subject = `Weekly study report: ${who} studied ${formatMinutes(total)}`;

  const text = [
    `Hi ${teacherName},`,
    "",
    `Here is ${who}'s study log for ${range}.`,
    "",
    `Total: ${formatMinutes(total)} across ${sorted.length} session${sorted.length === 1 ? "" : "s"}`,
    "",
    "By subject:",
    ...subjects.map(([name, minutes]) => `  - ${name}: ${formatMinutes(minutes)}`),
    "",
    "Sessions:",
    ...sorted.map((s) => `  - ${formatDay(s.studied_on)}: ${s.subject}, ${formatMinutes(s.minutes)}${s.notes ? `\n      Note: ${s.notes}` : ""}`),
    "",
    `Reply to this email to reach ${who} directly.`,
    "",
    "Sent by Smart School Tool",
  ].join("\n");

  const cell = 'style="padding:8px 12px;border-bottom:1px solid #e3e7f0;text-align:left;vertical-align:top"';
  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f6fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d2433">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px">
    <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e3e7f0">
      <p style="margin:0 0 4px;color:#4f7dff;font-weight:600">Weekly study report</p>
      <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(who)} studied ${escapeHtml(formatMinutes(total))}</h1>
      <p style="margin:0 0 16px">Hi ${escapeHtml(teacherName)}, here is ${escapeHtml(who)}'s study log for ${escapeHtml(range)}.</p>

      <h2 style="font-size:16px;margin:20px 0 8px">By subject</h2>
      <table style="border-collapse:collapse;width:100%">
        ${subjects.map(([name, minutes]) => `<tr><td ${cell}>${escapeHtml(name)}</td><td ${cell}><strong>${escapeHtml(formatMinutes(minutes))}</strong></td></tr>`).join("\n        ")}
      </table>

      <h2 style="font-size:16px;margin:20px 0 8px">Sessions</h2>
      <table style="border-collapse:collapse;width:100%">
        <tr><th ${cell}>Day</th><th ${cell}>What</th><th ${cell}>Time</th></tr>
        ${sorted.map((s) => `<tr><td ${cell}>${escapeHtml(formatDay(s.studied_on))}</td><td ${cell}>${escapeHtml(s.subject)}${s.notes ? `<br><span style="color:#6b7385;font-style:italic">${escapeHtml(s.notes)}</span>` : ""}</td><td ${cell}>${escapeHtml(formatMinutes(s.minutes))}</td></tr>`).join("\n        ")}
      </table>

      <p style="margin:20px 0 0;color:#6b7385;font-size:14px">Reply to this email to reach ${escapeHtml(who)} directly.</p>
    </div>
    <p style="text-align:center;color:#98a1b7;font-size:12px;margin:12px 0 0">Sent by Smart School Tool</p>
  </div>
</body></html>`;

  return { subject, text, html, replyTo: studentEmail, totalMinutes: total };
}
