/**
 * YachtDB — internal browser database (IndexedDB).
 * Primary durable store for rooms / inspections per user.
 * Survives larger datasets better than localStorage alone.
 */
(function (global) {
  const DB_NAME = "yacht-hkr-internal-db";
  const DB_VERSION = 1;
  const STORE_WORKSPACES = "workspaces";
  const STORE_INSPECTIONS = "inspections";
  const STORE_META = "meta";

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    if (!global.indexedDB) {
      dbPromise = Promise.reject(new Error("IndexedDB לא נתמך בדפדפן זה"));
      return dbPromise;
    }

    dbPromise = new Promise(function (resolve, reject) {
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = function () {
        reject(req.error || new Error("פתיחת DB נכשלה"));
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onupgradeneeded = function (event) {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORE_WORKSPACES)) {
          db.createObjectStore(STORE_WORKSPACES, { keyPath: "userId" });
        }

        if (!db.objectStoreNames.contains(STORE_INSPECTIONS)) {
          const insp = db.createObjectStore(STORE_INSPECTIONS, { keyPath: "id" });
          insp.createIndex("by_user", "userId", { unique: false });
          insp.createIndex("by_user_room", ["userId", "roomNumber"], { unique: false });
          insp.createIndex("by_user_room_num", ["userId", "roomNumber", "inspectionNumber"], {
            unique: true
          });
        }

        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      };
    });

    return dbPromise;
  }

  function txDone(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error || new Error("טרנזקציית DB נכשלה"));
      };
      tx.onabort = function () {
        reject(tx.error || new Error("טרנזקציית DB בוטלה"));
      };
    });
  }

  function reqToPromise(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
  }

  function flattenInspections(userId, workspace) {
    const rows = [];
    const rooms = (workspace && workspace.rooms) || {};
    Object.keys(rooms).forEach(function (rk) {
      const room = rooms[rk];
      const inspections = (room && room.inspections) || {};
      Object.keys(inspections).forEach(function (ik) {
        const insp = inspections[ik];
        if (!insp || !insp.id) return;
        rows.push({
          id: insp.id,
          userId: userId,
          roomNumber: room.roomNumber || rk,
          inspectionNumber: Number(insp.inspectionNumber),
          status: insp.status || "in_progress",
          inspectionDate: insp.date || null,
          roomType: insp.roomType || "",
          updatedAt: insp.updatedAt || null,
          dirty: !!insp.dirty,
          payload: insp
        });
      });
    });
    return rows;
  }

  const YachtDB = {
    name: DB_NAME,
    version: DB_VERSION,
    isSupported: !!(global.indexedDB),

    async open() {
      return openDb();
    },

    async getMeta(key) {
      const db = await openDb();
      const tx = db.transaction(STORE_META, "readonly");
      const store = tx.objectStore(STORE_META);
      const row = await reqToPromise(store.get(key));
      await txDone(tx);
      return row ? row.value : null;
    },

    async setMeta(key, value) {
      const db = await openDb();
      const tx = db.transaction(STORE_META, "readwrite");
      tx.objectStore(STORE_META).put({ key: key, value: value, updatedAt: new Date().toISOString() });
      await txDone(tx);
    },

    async loadWorkspace(userId) {
      if (!userId) return null;
      const db = await openDb();
      const tx = db.transaction(STORE_WORKSPACES, "readonly");
      const row = await reqToPromise(tx.objectStore(STORE_WORKSPACES).get(String(userId)));
      await txDone(tx);
      if (!row || !row.data) return null;
      return row.data;
    },

    /**
     * Persist full workspace + normalized inspection rows.
     */
    async saveWorkspace(userId, workspace) {
      if (!userId || !workspace) return;
      const uid = String(userId);
      const data = JSON.parse(JSON.stringify(workspace));
      data.userId = uid;
      data.version = data.version || 3;
      data.engine = "yacht-db-indexeddb";
      data.savedAt = new Date().toISOString();

      const db = await openDb();

      // Read existing inspection ids outside the write tx
      const readTx = db.transaction(STORE_INSPECTIONS, "readonly");
      const existing = await reqToPromise(
        readTx.objectStore(STORE_INSPECTIONS).index("by_user").getAllKeys(uid)
      );
      await txDone(readTx);

      const tx = db.transaction([STORE_WORKSPACES, STORE_INSPECTIONS], "readwrite");
      const ws = tx.objectStore(STORE_WORKSPACES);
      const inspStore = tx.objectStore(STORE_INSPECTIONS);

      ws.put({
        userId: uid,
        data: data,
        updatedAt: data.savedAt
      });

      (existing || []).forEach(function (id) {
        inspStore.delete(id);
      });
      flattenInspections(uid, data).forEach(function (row) {
        inspStore.put(row);
      });

      await txDone(tx);
      return data;
    },

    async listInspections(userId) {
      if (!userId) return [];
      const db = await openDb();
      const tx = db.transaction(STORE_INSPECTIONS, "readonly");
      const rows = await reqToPromise(
        tx.objectStore(STORE_INSPECTIONS).index("by_user").getAll(String(userId))
      );
      await txDone(tx);
      return rows || [];
    },

    async countForUser(userId) {
      const rows = await this.listInspections(userId);
      const rooms = {};
      rows.forEach(function (r) {
        rooms[r.roomNumber] = true;
      });
      return { rooms: Object.keys(rooms).length, inspections: rows.length };
    },

    async clearUser(userId) {
      if (!userId) return;
      const uid = String(userId);
      const db = await openDb();

      const readTx = db.transaction(STORE_INSPECTIONS, "readonly");
      const existing = await reqToPromise(
        readTx.objectStore(STORE_INSPECTIONS).index("by_user").getAllKeys(uid)
      );
      await txDone(readTx);

      const tx = db.transaction([STORE_WORKSPACES, STORE_INSPECTIONS], "readwrite");
      tx.objectStore(STORE_WORKSPACES).delete(uid);
      const inspStore = tx.objectStore(STORE_INSPECTIONS);
      (existing || []).forEach(function (id) {
        inspStore.delete(id);
      });
      await txDone(tx);
    }
  };

  global.YachtDB = YachtDB;
})(window);
