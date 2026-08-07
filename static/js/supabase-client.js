/**
 * Supabase client bootstrap (anon key only).
 */
(function (global) {
  function isConfigured() {
    const cfg = global.SUPABASE_CONFIG || {};
    return !!(cfg.url && cfg.anonKey && String(cfg.url).trim() && String(cfg.anonKey).trim());
  }

  function getClient() {
    if (!isConfigured()) {
      throw new Error("חסרים פרטי Supabase (URL / anon key) בקובץ supabase-config.js");
    }
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      throw new Error("ספריית Supabase לא נטענה");
    }
    if (!global.__yachtSupabaseClient) {
      const cfg = global.SUPABASE_CONFIG;
      global.__yachtSupabaseClient = global.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return global.__yachtSupabaseClient;
  }

  global.SupabaseApp = {
    isConfigured: isConfigured,
    getClient: getClient
  };
})(window);
