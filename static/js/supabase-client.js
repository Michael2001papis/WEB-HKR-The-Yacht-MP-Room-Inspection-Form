/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001 | Release V0.02.0
 * Supabase client bootstrap (anon key only). Optional — app works without it.
 */
(function (global) {
  function isConfigured() {
    const cfg = global.SUPABASE_CONFIG || {};
    return !!(
      cfg.url &&
      cfg.anonKey &&
      String(cfg.url).trim() &&
      String(cfg.anonKey).trim()
    );
  }

  function hasCloudEmail() {
    const cfg = global.SUPABASE_CONFIG || {};
    return !!(cfg.cloudEmail && String(cfg.cloudEmail).trim());
  }

  function isCloudReady() {
    return isConfigured() && hasCloudEmail();
  }

  function getClient() {
    if (!isConfigured()) {
      throw new Error("Supabase אינו מוגדר");
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
          detectSessionInUrl: false
        }
      });
    }
    return global.__yachtSupabaseClient;
  }

  global.SupabaseApp = {
    isConfigured: isConfigured,
    isCloudReady: isCloudReady,
    getClient: getClient
  };
})(window);
