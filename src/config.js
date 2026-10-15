// Supabase project used for accounts. Both values are public by design: what each account can
// read or change is enforced on the server by row level security (see supabase/schema.sql).
// Never put the service_role / secret key here.
window.APP_CONFIG = {
  supabaseUrl: "https://kjnvkgzqwsgjexcysjjj.supabase.co",
  supabaseKey: "sb_publishable_5IS9iPy3uLhCPF7ircsLbA_J3hODj7U",
  // Where the "reset your password" email link sends people.
  resetPasswordUrl: "https://notisaac132-star.github.io/Isaac-s-Smart-School-Tool/reset-password.html",
  // Short links to shared PDFs (the code is added after the "?").
  shareLinkBase: "https://notisaac132-star.github.io/Isaac-s-Smart-School-Tool/f/?",
  // Google sign-in for attaching PDFs to Gmail drafts (Chromebook / web version). Public by design.
  // Empty = turned off (emails get a short download link instead). How to get one: README "Gmail attachments".
  googleClientId: "",
};
