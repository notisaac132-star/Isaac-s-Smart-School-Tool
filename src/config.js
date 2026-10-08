// Supabase project used for accounts. Both values are public by design: what each account can
// read or change is enforced on the server by row level security (see supabase/schema.sql).
// Never put the service_role / secret key here.
window.APP_CONFIG = {
  supabaseUrl: "https://kjnvkgzqwsgjexcysjjj.supabase.co",
  supabaseKey: "sb_publishable_5IS9iPy3uLhCPF7ircsLbA_J3hODj7U",
  // Where the "reset your password" email link sends people.
  resetPasswordUrl: "https://notisaac132-star.github.io/Isaac-s-Smart-School-Tool/reset-password.html",
};
