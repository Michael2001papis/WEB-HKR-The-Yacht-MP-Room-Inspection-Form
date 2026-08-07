/**
 * Auth: signup / login / logout / session for Supabase Free.
 */
(function (global) {
  const Auth = {
    _user: null,
    _listeners: [],

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

    async signUp(email, password) {
      const client = global.SupabaseApp.getClient();
      const { data, error } = await client.auth.signUp({
        email: String(email || "").trim(),
        password: String(password || "")
      });
      if (error) throw error;
      this._user = data.user || (data.session && data.session.user) || null;
      this._emit();
      return data;
    },

    async signIn(email, password) {
      const client = global.SupabaseApp.getClient();
      const { data, error } = await client.auth.signInWithPassword({
        email: String(email || "").trim(),
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
