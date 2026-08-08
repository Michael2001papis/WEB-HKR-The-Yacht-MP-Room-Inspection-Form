/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001 | Release V0.02.0
 * Optional shared cloud (Supabase Free) — fill to sync phone ↔ computer.
 * Leave empty to keep local-only mode (no blocking errors).
 *
 * Setup once:
 * 1) Create Supabase Free project
 * 2) Run supabase/schema.sql in SQL Editor
 * 3) Auth → Email: disable Confirm email (for single private user)
 * 4) Create user with cloudEmail + same password you use in the app (1234)
 * 5) Paste Project URL + anon public key below
 *
 * Login UI stays MP2001 / 1234. Cloud uses cloudEmail behind the scenes.
 * Rollback keyword from chat: «כיפה אדומה» → revert A1 cloud wiring.
 */
(function (global) {
  global.SUPABASE_CONFIG = {
    url: "",
    anonKey: "",
    /** Email of the single Supabase Auth user (not shown in the UI). */
    cloudEmail: ""
  };
})(window);
