/**
 * Local gate auth (single user).
 * Username + password checked in the browser; session kept in localStorage.
 * Auto sign-out after 90 minutes without activity.
 */
(function (global) {
  const SESSION_KEY = "yacht-local-session-v1";
  const IDLE_MS = 90 * 60 * 1000; // 90 minutes
  const CHECK_EVERY_MS = 30 * 1000;

  /** Only this account may enter the app. */
  const LOCAL_ACCOUNT = {
    username: "MP2001",
    password: "1234",
    userId: "local-mp2001"
  };

  let idleTimer = null;
  let activityBound = false;
  let touchThrottle = null;

  function normalizeUsername(value) {
    return String(value || "").trim();
  }

  function now() {
    return Date.now();
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

  function writeSession(user, lastActiveAt) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: user.id,
        username: user.username,
        loggedInAt: user.loggedInAt || new Date().toISOString(),
        lastActiveAt: typeof lastActiveAt === "number" ? lastActiveAt : now()
      })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function makeUser(session) {
    return {
      id: LOCAL_ACCOUNT.userId,
      username: LOCAL_ACCOUNT.username,
      email: null,
      loggedInAt: (session && session.loggedInAt) || new Date().toISOString(),
      user_metadata: {
        username: LOCAL_ACCOUNT.username,
        display_name: LOCAL_ACCOUNT.username
      }
    };
  }

  function isExpired(session) {
    if (!session) return true;
    const last = Number(session.lastActiveAt || 0);
    if (!last) return true;
    return now() - last >= IDLE_MS;
  }

  const Auth = {
    _user: null,
    _listeners: [],
    _idleListeners: [],
    expiredOnInit: false,

    IDLE_MS: IDLE_MS,

    onChange(fn) {
      this._listeners.push(fn);
    },

    onIdleTimeout(fn) {
      this._idleListeners.push(fn);
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

    _emitIdleTimeout() {
      this._idleListeners.forEach(function (fn) {
        try {
          fn();
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

    /**
     * Refresh activity timestamp (throttled).
     */
    touch() {
      if (!this._user) return;
      if (touchThrottle) return;
      touchThrottle = setTimeout(function () {
        touchThrottle = null;
      }, 2000);

      const session = readSession() || {};
      writeSession(this._user, now());
      // keep loggedInAt stable
      if (session.loggedInAt) {
        this._user.loggedInAt = session.loggedInAt;
      }
    },

    /**
     * If idle window passed — sign out and notify.
     * @returns {boolean} true if still logged in
     */
    checkIdle() {
      if (!this._user) return false;
      const session = readSession();
      if (!session || isExpired(session)) {
        this._user = null;
        clearSession();
        this.stopIdleWatch();
        this._emit();
        this._emitIdleTimeout();
        return false;
      }
      return true;
    },

    startIdleWatch() {
      const self = this;
      this.stopIdleWatch();

      if (!activityBound) {
        activityBound = true;
        const bump = function () {
          if (self._user) self.touch();
        };
        ["pointerdown", "keydown", "touchstart", "scroll", "click"].forEach(function (evt) {
          document.addEventListener(evt, bump, { passive: true, capture: true });
        });
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible") {
            self.checkIdle();
            if (self._user) self.touch();
          }
        });
        window.addEventListener("focus", function () {
          self.checkIdle();
          if (self._user) self.touch();
        });
      }

      idleTimer = setInterval(function () {
        self.checkIdle();
      }, CHECK_EVERY_MS);

      this.touch();
    },

    stopIdleWatch() {
      if (idleTimer) {
        clearInterval(idleTimer);
        idleTimer = null;
      }
    },

    async init() {
      this.expiredOnInit = false;
      const session = readSession();
      if (!session) {
        this._user = null;
        this._emit();
        return null;
      }
      if (isExpired(session)) {
        this.expiredOnInit = true;
        clearSession();
        this._user = null;
        this._emit();
        return null;
      }
      this._user = makeUser(session);
      this._emit();
      return this._user;
    },

    async signIn(loginId, password) {
      const username = normalizeUsername(loginId);
      const pass = String(password || "");

      if (!username || !pass) {
        throw new Error("נא למלא שם משתמש וסיסמה.");
      }

      if (username !== LOCAL_ACCOUNT.username || pass !== LOCAL_ACCOUNT.password) {
        throw new Error("שם משתמש או סיסמה שגויים.");
      }

      this._user = makeUser(null);
      writeSession(this._user, now());
      this._emit();
      return { user: this._user };
    },

    async signOut() {
      this._user = null;
      clearSession();
      this.stopIdleWatch();
      this._emit();
    }
  };

  global.Auth = Auth;
})(window);
