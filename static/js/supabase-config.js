/**
 * Supabase cloud sync is disabled for this deployment.
 * Login is local-only (see auth.js). Keep empty so SyncEngine stays offline/local.
 */
(function (global) {
  global.SUPABASE_CONFIG = {
    url: "",
    anonKey: "",
    usernameAccounts: {}
  };
})(window);
