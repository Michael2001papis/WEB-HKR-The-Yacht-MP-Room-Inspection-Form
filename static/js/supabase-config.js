/**
 * Supabase Free — public client config only.
 *
 * Fill in:
 * - Project URL + anon (public) key from Supabase → Project Settings → API
 * - usernameAccounts: map display usernames → real Auth emails
 *
 * NEVER put passwords or service_role / secret keys here.
 * Passwords are typed by the user at login only; Supabase issues the JWT.
 */
(function (global) {
  global.SUPABASE_CONFIG = {
    url: "",
    anonKey: "",

    /**
     * App shows these usernames; Supabase Auth uses the email behind the scenes.
     * Example: type MP2001 + password → signInWithPassword(email, password).
     * Create the user once in Supabase Auth (or via "יצירת חשבון") with that email.
     */
    usernameAccounts: {
      MP2001: {
        email: ""
      }
    }
  };
})(window);
