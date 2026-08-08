/**
 * Local gate auth (single user).
 * Username + password checked in the browser; session kept in localStorage.
 * Cloud / Supabase Auth is not used.
 */
(function (global) {
  const SESSION_KEY = "yacht-local-session-v1";

  /** Only this account may enter the app. */
  const LOCAL_ACCOUNT = {
    username: "MP2001",
    password: "1234",
    userId: "local-mp2001"
  };

  function normalizeUsername(value) {
    return String(value || "").trim();
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || data.userId !== LOCAL_ACCOUNT.userId) return null;
      if (normalizeUsername(data.username) !== LOCAL_ACCOUNT.username) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeSession(user) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: user.id,
        username: user.username,
        loggedInAt: new Date().toISOString()
      })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function makeUser() {
    return {
      id: LOCAL_ACCOUNT.userId,
      username: LOCAL_ACCOUNT.username,
      email: null,
      user_metadata: {
        username: LOCAL_ACCOUNT.username,
        display_name: LOCAL_ACCOUNT.username
      }
    };
  }

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

    getDisplayName(user) {
      const u = user || this._user;
      if (!u) return "";
      return (
        (u.user_metadata && (u.user_metadata.username || u.user_metadata.display_name)) ||
        u.username ||
        ""
      );
    },

    getUser() {
      return this._user;
    },

    isLoggedIn() {
      return !!(this._user && this._user.id);
    },

    async init() {
      const session = readSession();
      this._user = session ? makeUser() : null;
      this._emit();
      return this._user;
    },

    /**
     * Sign in with the local username + password only.
     */
    async signIn(loginId, password) {
      const username = normalizeUsername(loginId);
      const pass = String(password || "");

      if (!username || !pass) {
        throw new Error("נא למלא שם משתמש וסיסמה.");
      }

      if (username !== LOCAL_ACCOUNT.username || pass !== LOCAL_ACCOUNT.password) {
        throw new Error("שם משתמש או סיסמה שגויים.");
      }

      this._user = makeUser();
      writeSession(this._user);
      this._emit();
      return { user: this._user };
    },

    async signOut() {
      this._user = null;
      clearSession();
      this._emit();
    }
  };

  global.Auth = Auth;
})(window);
