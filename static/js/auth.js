/**
 * Auth: signup / login / logout / session for Supabase Free.
 * UI can use a display username (e.g. MP2001); Auth always uses a real email.
 * JWT/session are created and managed only by Supabase — never manually.
 */
(function (global) {
  function normalizeUsername(value) {
    return String(value || "").trim();
  }

  function getUsernameAccounts() {
    const cfg = global.SUPABASE_CONFIG || {};
    return cfg.usernameAccounts || {};
  }

  function lookupAccount(username) {
    const key = normalizeUsername(username);
    if (!key) return null;
    const accounts = getUsernameAccounts();
    if (accounts[key]) return { username: key, email: String(accounts[key].email || "").trim() };
    const lower = key.toLowerCase();
    for (const name of Object.keys(accounts)) {
      if (name.toLowerCase() === lower) {
        return { username: name, email: String(accounts[name].email || "").trim() };
      }
    }
    return null;
  }

  function findUsernameByEmail(email) {
    const target = String(email || "").trim().toLowerCase();
    if (!target) return null;
    const accounts = getUsernameAccounts();
    for (const name of Object.keys(accounts)) {
      const mapped = String(accounts[name].email || "").trim().toLowerCase();
      if (mapped && mapped === target) return name;
    }
    return null;
  }

  /**
   * Resolve login identity from the form value.
   * - Known username (MP2001) → mapped email
   * - Raw email (contains @) → use as-is (other users)
   */
  function resolveIdentity(loginId) {
    const raw = normalizeUsername(loginId);
    if (!raw) {
      return { ok: false, error: "נא למלא שם משתמש." };
    }

    const account = lookupAccount(raw);
    if (account) {
      if (!account.email) {
        return {
          ok: false,
          error:
            "למשתמש " +
            account.username +
            " חסרה כתובת אימייל ב־supabase-config.js (usernameAccounts)."
        };
      }
      return {
        ok: true,
        username: account.username,
        email: account.email
      };
    }

    if (raw.indexOf("@") !== -1) {
      return { ok: true, username: null, email: raw };
    }

    return {
      ok: false,
      error: "שם משתמש לא מזוהה. השתמשו ב־MP2001 או באימייל של החשבון."
    };
  }

  function getDisplayName(user) {
    if (!user) return "";
    const meta = user.user_metadata || {};
    if (meta.username) return String(meta.username);
    if (meta.display_name) return String(meta.display_name);
    const mapped = findUsernameByEmail(user.email);
    if (mapped) return mapped;
    return user.email || "";
  }

  const Auth = {
    _user: null,
    _listeners: [],

    resolveIdentity: resolveIdentity,
    getDisplayName: getDisplayName,
    lookupAccount: lookupAccount,

    onChange(fn) {
      this._listeners.push(fn);
    },

    _emit() {
      const user = this._user;
      this._listeners.forEach(function (fn) {
        try {
          fn(user);
        } catch (e) {
          console.error(e);
        }
      });
    },

    getUser() {
      return this._user;
    },

    isLoggedIn() {
      return !!(this._user && this._user.id);
    },

    async init() {
      if (!global.SupabaseApp.isConfigured()) {
        this._user = null;
        this._emit();
        return null;
      }
      const client = global.SupabaseApp.getClient();
      const { data, error } = await client.auth.getSession();
      if (error) console.error(error);
      this._user = data && data.session ? data.session.user : null;
      this._emit();

      client.auth.onAuthStateChange(function (_event, session) {
        Auth._user = session ? session.user : null;
        Auth._emit();
      });

      return this._user;
    },

    /**
     * Create account via Supabase Auth (email + password).
     * Optional username is stored in user_metadata for display only.
     * Supabase issues the session JWT — we never mint tokens locally.
     */
    async signUp(loginId, password) {
      const identity = resolveIdentity(loginId);
      if (!identity.ok) throw new Error(identity.error);
      const client = global.SupabaseApp.getClient();
      const options = {};
      if (identity.username) {
        options.data = {
          username: identity.username,
          display_name: identity.username
        };
      }
      const { data, error } = await client.auth.signUp({
        email: identity.email,
        password: String(password || ""),
        options: options
      });
      if (error) throw error;
      this._user = data.user || (data.session && data.session.user) || null;
      this._emit();
      return data;
    },

    /**
     * Sign in via Supabase Auth. Password is only the value typed now — never from config.
     */
    async signIn(loginId, password) {
      const identity = resolveIdentity(loginId);
      if (!identity.ok) throw new Error(identity.error);
      const client = global.SupabaseApp.getClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: identity.email,
        password: String(password || "")
      });
      if (error) throw error;
      this._user = data.user || (data.session && data.session.user) || null;
      this._emit();
      return data;
    },

    async signOut() {
      if (!global.SupabaseApp.isConfigured()) {
        this._user = null;
        this._emit();
        return;
      }
      const client = global.SupabaseApp.getClient();
      const { error } = await client.auth.signOut();
      if (error) throw error;
      this._user = null;
      this._emit();
    }
  };

  global.Auth = Auth;
})(window);
