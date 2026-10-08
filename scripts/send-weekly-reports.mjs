// Emails each student's unreported study sessions to their teachers, then marks them as reported.
// Run weekly by .github/workflows/weekly-reports.yml.
//
// Needs: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD.
// DRY_RUN=1 builds the emails and prints counts without sending or changing anything.
// SMTP_URL (optional) sends through another mail server instead of Gmail, e.g. smtp://user:pass@host:587.
//
// The repository is public, so this only ever logs counts, never names or email addresses.

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { buildReport } from "./report.mjs";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, SMTP_URL } = process.env;
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Missing settings: ${missing.join(", ")}. Add them under Settings → Secrets and variables → Actions.`);
    process.exit(1);
  }
}

requireEnv([
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  ...(DRY_RUN ? [] : SMTP_URL ? ["GMAIL_USER"] : ["GMAIL_USER", "GMAIL_APP_PASSWORD"]),
]);

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const mailer = DRY_RUN
  ? null
  : nodemailer.createTransport(SMTP_URL || { service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });

// Emails one student's sessions to each of their report recipients. Returns "sent", "skipped" or "failed".
async function reportStudent(userId, studentSessions, stats) {
  const { data: userData, error: userError } = await db.auth.admin.getUserById(userId);
  if (userError || !userData.user) {
    console.error(`A student account couldn't be loaded: ${userError ? userError.message : "not found"}`);
    return "failed";
  }
  const student = userData.user;

  const { data: recipients, error: contactsError } = await db
    .from("contacts")
    .select("name, email")
    .eq("user_id", userId)
    .eq("reports", true);
  if (contactsError) {
    console.error(`A student's teachers couldn't be loaded: ${contactsError.message}`);
    return "failed";
  }
  if (recipients.length === 0) {
    // Nobody to send to yet; keep the sessions for next week.
    stats.skippedNoRecipients++;
    return "skipped";
  }

  let allSent = true;
  for (const teacher of recipients) {
    const report = buildReport({
      studentName: (student.user_metadata && student.user_metadata.name) || "",
      studentEmail: student.email,
      teacherName: teacher.name,
      sessions: studentSessions,
    });
    if (DRY_RUN) {
      stats.emailsSent++;
      continue;
    }
    try {
      await mailer.sendMail({
        from: { name: "Smart School Tool", address: GMAIL_USER },
        to: { name: teacher.name, address: teacher.email },
        replyTo: report.replyTo,
        subject: report.subject,
        text: report.text,
        html: report.html,
      });
      stats.emailsSent++;
    } catch (sendError) {
      allSent = false;
      console.error(`An email failed to send: ${sendError.message}`);
    }
  }

  // Leave the sessions unreported so the next run tries again.
  if (!allSent) return "failed";
  if (DRY_RUN) return "sent";

  const { error: markError } = await db
    .from("study_sessions")
    .update({ reported_at: new Date().toISOString() })
    .in("id", studentSessions.map((s) => s.id));
  if (markError) {
    console.error(`Sessions were emailed but couldn't be marked as sent: ${markError.message}`);
    return "failed";
  }
  return "sent";
}

async function main() {
  if (mailer) await mailer.verify();

  const { data: sessions, error } = await db
    .from("study_sessions")
    .select("id, user_id, subject, minutes, studied_on, notes")
    .is("reported_at", null)
    .order("studied_on");
  if (error) throw new Error(`Couldn't read study sessions: ${error.message}`);

  const byStudent = new Map();
  for (const s of sessions) {
    if (!byStudent.has(s.user_id)) byStudent.set(s.user_id, []);
    byStudent.get(s.user_id).push(s);
  }

  const stats = { students: byStudent.size, emailsSent: 0, skippedNoRecipients: 0, failedStudents: 0 };

  for (const [userId, studentSessions] of byStudent) {
    try {
      if ((await reportStudent(userId, studentSessions, stats)) === "failed") stats.failedStudents++;
    } catch (studentError) {
      // One student's problem shouldn't stop everyone else's report.
      stats.failedStudents++;
      console.error(`A student's report failed: ${studentError.message}`);
    }
  }

  console.log(`${DRY_RUN ? "[dry run] " : ""}Students with new study time: ${stats.students}`);
  console.log(`${DRY_RUN ? "[dry run] Emails that would be sent" : "Emails sent"}: ${stats.emailsSent}`);
  console.log(`Students with no teacher set to get reports (kept for next week): ${stats.skippedNoRecipients}`);
  if (stats.failedStudents) {
    console.error(`Students whose report failed (will retry next run): ${stats.failedStudents}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
