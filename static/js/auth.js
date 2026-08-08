/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001 | Release V0.02.0
 * Local gate auth (single user) + optional Supabase cloud session for sync.
 * Username + password checked locally; session in localStorage.
 * Auto sign-out after 90 minutes without activity.
 */
(function (global) {
  const SESSION_KEY = "yacht-local-session-v1";
  const IDLE_MS = 90 * 60 * 1000;
  const CHECK_EVERY_MS = 30 * 1000;
  const LOCAL_USER_ID = "local-mp2001";

  const LOCAL_ACCOUNT = {
    username: "MP2001",
    password: "1234",
    userId: LOCAL_USER_ID
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
      if (!data || normalizeUsername(data.username) !== LOCAL_ACCOUNT.username) return null;
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
        cloud: !!user.cloud,
        loggedInAt: user.loggedInAt || new Date().toISOString(),
        lastActiveAt: typeof lastActiveAt === "number" ? lastActiveAt : now()
      })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function makeUser(session, overrides) {
    const base = {
      id: (session && session.userId) || LOCAL_ACCOUNT.userId,
      username: LOCAL_ACCOUNT.username,
      email: null,
      cloud: !!(session && session.cloud),
      loggedInAt: (session && session.loggedInAt) || new Date().toISOString(),
      user_metadata: {
        username: LOCAL_ACCOUNT.username,
        display_name: LOCAL_ACCOUNT.username
      }
    };
    if (overrides) {
      Object.keys(overrides).forEach(function (k) {
        base[k] = overrides[k];
      });
    }
    return base;
  }

  function isExpired(session) {
    if (!session) return true;
    const last = Number(session.lastActiveAt || 0);
    if (!last) return true;
    return now() - last >= IDLE_MS;
  }

  async function connectCloud(password) {
    if (!global.SupabaseApp || !SupabaseApp.isCloudReady()) {
      return { ok: false, reason: "not_configured" };
    }
    if (!global.supabase) {
      return { ok: false, reason: "sdk_missing" };
    }
    try {
      const client = SupabaseApp.getClient();
      const email = String(SUPABASE_CONFIG.cloudEmail || "").trim();
      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: String(password || "")
      });
      if (error) {
        // First-time: try create then sign-in
        const signedUp = await client.auth.signUp({
          email: email,
          password: String(password || ""),
          options: {
            data: {
              username: LOCAL_ACCOUNT.username,
              display_name: LOCAL_ACCOUNT.username
            }
          }
        });
        if (signedUp.error) {
          return { ok: false, reason: error.message || signedUp.error.message };
        }
        if (signedUp.data && signedUp.data.session && signedUp.data.user) {
          return { ok: true, user: signedUp.data.user };
        }
        const again = await client.auth.signInWithPassword({
          email: email,
          password: String(password || "")
        });
        if (again.error) {
          return { ok: false, reason: again.error.message };
        }
        return { ok: true, user: again.data.user };
      }
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, reason: (e && e.message) || "cloud_error" };
    }
  }

  async function restoreCloudSession() {
    if (!global.SupabaseApp || !SupabaseApp.isCloudReady() || !global.supabase) {
      return null;
    }
    try {
      const client = SupabaseApp.getClient();
      const { data } = await client.auth.getSession();
      return data && data.session ? data.session.user : null;
    } catch (e) {
      return null;
    }
  }

  const Auth = {
    _user: null,
    _listeners: [],
    _idleListeners: [],
    expiredOnInit: false,
    cloudStatus: "local", // local | connected | failed
    cloudMessage: "",
    LOCAL_USER_ID: LOCAL_USER_ID,
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

    isCloudConnected() {
      return !!(this._user && this._user.cloud && this.cloudStatus === "connected");
    },

    touch() {
      if (!this._user) return;
      if (touchThrottle) return;
      touchThrottle = setTimeout(function () {
        touchThrottle = null;
      }, 2000);
      const session = readSession() || {};
      writeSession(this._user, now());
      if (session.loggedInAt) this._user.loggedInAt = session.loggedInAt;
    },

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
      this.cloudStatus = "local";
      this.cloudMessage = "";
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

      const cloudUser = await restoreCloudSession();
      if (cloudUser && cloudUser.id) {
        this._user = makeUser(session, {
          id: cloudUser.id,
          cloud: true,
          email: cloudUser.email || null
        });
        this.cloudStatus = "connected";
        writeSession(this._user, session.lastActiveAt || now());
      } else {
        this._user = makeUser(session, {
          id: LOCAL_ACCOUNT.userId,
          cloud: false
        });
        this.cloudStatus = "local";
      }
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

      this.cloudStatus = "local";
      this.cloudMessage = "";
      this._user = makeUser(null, { id: LOCAL_ACCOUNT.userId, cloud: false });
      writeSession(this._user, now());

      const cloud = await connectCloud(pass);
      if (cloud.ok && cloud.user) {
        this._user = makeUser(null, {
          id: cloud.user.id,
          cloud: true,
          email: cloud.user.email || null
        });
        this.cloudStatus = "connected";
        writeSession(this._user, now());
      } else if (global.SupabaseApp && SupabaseApp.isCloudReady()) {
        this.cloudStatus = "failed";
        this.cloudMessage = cloud.reason || "";
      }

      this._emit();
      return { user: this._user, cloudStatus: this.cloudStatus };
    },

    async signOut() {
      try {
        if (global.SupabaseApp && SupabaseApp.isConfigured() && global.supabase) {
          const client = SupabaseApp.getClient();
          await client.auth.signOut();
        }
      } catch (e) {
        console.error(e);
      }
      this._user = null;
      this.cloudStatus = "local";
      this.cloudMessage = "";
      clearSession();
      this.stopIdleWatch();
      this._emit();
    }
  };

  global.Auth = Auth;
})(window);
