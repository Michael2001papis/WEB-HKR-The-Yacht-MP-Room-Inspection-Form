/**
 * App storage layer — in-memory workspace + IndexedDB (YachtDB) primary.
 * localStorage kept as mirror/fallback for older browsers / emergency recovery.
 * Legacy key yacht-room-inspections-v1 is never deleted by this layer.
 */
(function (global) {
  const LEGACY_KEY = "yacht-room-inspections-v1";
  const CACHE_PREFIX = "yacht-cloud-cache-v1:";

  let activeUserId = null;
  let memoryStore = null;
  let changeListeners = [];
  let persistTimer = null;
  let dbReady = false;

  function emptyStore() {
    return {
      rooms: {},
      lastActive: null,
      version: 3,
      userId: activeUserId || null,
      engine: "yacht-db-indexeddb"
    };
  }

  function cacheKey() {
    if (!activeUserId) return null;
    return CACHE_PREFIX + activeUserId;
  }

  function readLocalMirror() {
    const key = cacheKey();
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return null;
      if (!data.rooms) data.rooms = {};
      return data;
    } catch (e) {
      console.error("Failed to read local mirror", e);
      return null;
    }
  }

  function writeLocalMirror(data) {
    const key = cacheKey();
    if (!key || !data) return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to write local mirror", e);
    }
  }

  function load() {
    if (!activeUserId) return emptyStore();
    if (!memoryStore) memoryStore = emptyStore();
    if (!memoryStore.rooms) memoryStore.rooms = {};
    return memoryStore;
  }

  function schedulePersist(data) {
    if (!activeUserId) return;
    writeLocalMirror(data);
    if (!global.YachtDB || !YachtDB.isSupported) return;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(function () {
      YachtDB.saveWorkspace(activeUserId, data).catch(function (err) {
        console.error("YachtDB save failed", err);
      });
    }, 40);
  }

  function save(data) {
    if (!activeUserId) return;
    data.userId = activeUserId;
    data.version = 3;
    data.engine = "yacht-db-indexeddb";
    memoryStore = data;
    schedulePersist(data);
  }

  function notifyChange(detail) {
    changeListeners.forEach(function (fn) {
      try {
        fn(detail || {});
      } catch (e) {
        console.error(e);
      }
    });
  }

  function todayISO() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return yyyy + "-" + mm + "-" + dd;
  }

  function formatDisplayDate(iso) {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function formatFileDate(iso) {
    if (!iso) {
      const d = new Date();
      return (
        String(d.getDate()).padStart(2, "0") +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        d.getFullYear()
      );
    }
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }

  function newId() {
    if (global.crypto && typeof global.crypto.randomUUID === "function") {
      return global.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function createEmptyItems() {
    const items = {};
    for (const key of global.allItemKeys()) {
      const meta = global.findItemMeta(key);
      items[key] = {
        exists: meta && meta.item.optionalExists ? null : true,
        status: null,
        note: ""
      };
    }
    return items;
  }

  function createInspection(inspectionNumber, meta) {
    const now = new Date().toISOString();
    return {
      id: newId(),
      inspectionNumber: inspectionNumber,
      date: todayISO(),
      roomType: (meta && meta.roomType) || "",
      extraId: (meta && meta.extraId) || "",
      generalNotes: "",
      status: "in_progress",
      items: createEmptyItems(),
      createdAt: now,
      updatedAt: now,
      dirty: true,
      lastSyncedAt: null,
      legacyKey: null
    };
  }

  function ensureRoom(store, roomNumber) {
    const key = String(roomNumber).trim();
    if (!store.rooms[key]) {
      store.rooms[key] = {
        roomNumber: key,
        inspections: {},
        updatedAt: new Date().toISOString()
      };
    }
    return store.rooms[key];
  }

  function getInspectionStats(inspection) {
    let checked = 0;
    let ok = 0;
    let defects = 0;
    const defectList = [];

    if (!inspection || !inspection.items) {
      return { checked: 0, ok: 0, defects: 0, defectList: [] };
    }

    for (const key of Object.keys(inspection.items)) {
      const row = inspection.items[key];
      const meta = global.findItemMeta(key);
      if (!meta) continue;

      if (meta.item.optionalExists && row.exists === false) continue;
      if (meta.item.optionalExists && row.exists !== true) continue;

      if (row.status === "ok") {
        checked++;
        ok++;
      } else if (row.status === "not_ok") {
        checked++;
        defects++;
        defectList.push({
          key: key,
          categoryName: meta.category.name,
          itemName: meta.item.name,
          note: row.note || ""
        });
      }
    }

    return { checked, ok, defects, defectList };
  }

  function listMissingDefectNotes(inspection) {
    const missing = [];
    if (!inspection || !inspection.items) return missing;

    for (const key of Object.keys(inspection.items)) {
      const row = inspection.items[key];
      const meta = global.findItemMeta(key);
      if (!meta) continue;
      if (meta.item.optionalExists && row.exists === false) continue;
      if (meta.item.optionalExists && row.exists !== true) continue;
      if (row.status === "not_ok" && !(row.note && row.note.trim())) {
        missing.push({
          key: key,
          itemName: meta.item.name,
          categoryName: meta.category.name
        });
      }
    }
    return missing;
  }

  function markDirty(inspection) {
    if (!inspection) return;
    inspection.dirty = true;
    inspection.updatedAt = new Date().toISOString();
  }

  const Storage = {
    LEGACY_KEY: LEGACY_KEY,
    todayISO,
    formatDisplayDate,
    formatFileDate,
    newId,

    onChange(fn) {
      changeListeners.push(fn);
    },

    async initDb() {
      if (!global.YachtDB || !YachtDB.isSupported) {
        dbReady = false;
        return { ok: false, engine: "localStorage-only" };
      }
      try {
        await YachtDB.open();
        dbReady = true;
        return { ok: true, engine: "indexeddb", name: YachtDB.name };
      } catch (e) {
        console.error(e);
        dbReady = false;
        return { ok: false, engine: "localStorage-only", error: e };
      }
    },

    isDbReady() {
      return dbReady;
    },

    async activateUser(userId) {
      activeUserId = userId ? String(userId) : null;
      memoryStore = null;
      if (!activeUserId) return null;

      let data = null;
      if (global.YachtDB && YachtDB.isSupported) {
        try {
          if (!dbReady) await this.initDb();
          data = await YachtDB.loadWorkspace(activeUserId);
        } catch (e) {
          console.error("YachtDB load failed", e);
        }
      }

      if (!data || !data.rooms) {
        data = readLocalMirror();
      }

      if (!data || !Object.keys(data.rooms || {}).length) {
        try {
          const raw = localStorage.getItem(LEGACY_KEY);
          if (raw) {
            const legacy = JSON.parse(raw);
            if (legacy && legacy.rooms && Object.keys(legacy.rooms).length) {
              data = {
                rooms: legacy.rooms,
                lastActive: legacy.lastActive || null,
                version: 3,
                userId: activeUserId,
                migratedFrom: LEGACY_KEY
              };
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      if (!data || typeof data !== "object") data = emptyStore();
      if (!data.rooms) data.rooms = {};
      data.userId = activeUserId;
      data.version = 3;
      data.engine = dbReady ? "yacht-db-indexeddb" : "localStorage";
      memoryStore = data;
      schedulePersist(data);
      return data;
    },

    setActiveUser(userId) {
      activeUserId = userId ? String(userId) : null;
      if (!activeUserId) memoryStore = null;
    },

    getActiveUser() {
      return activeUserId;
    },

    replaceStore(data) {
      if (!activeUserId) return;
      const next = data && typeof data === "object" ? data : emptyStore();
      if (!next.rooms) next.rooms = {};
      next.userId = activeUserId;
      save(next);
      notifyChange({ type: "replace" });
    },

    getLegacyStore() {
      try {
        const raw = localStorage.getItem(LEGACY_KEY);
        if (!raw) return emptyStore();
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object") return emptyStore();
        if (!data.rooms) data.rooms = {};
        return data;
      } catch (e) {
        console.error("Failed to load legacy store", e);
        return emptyStore();
      }
    },

    countLegacy() {
      const store = this.getLegacyStore();
      const roomKeys = Object.keys(store.rooms || {});
      let inspections = 0;
      roomKeys.forEach(function (rk) {
        const room = store.rooms[rk];
        inspections += Object.keys((room && room.inspections) || {}).length;
      });
      return { rooms: roomKeys.length, inspections: inspections };
    },

    getAll() {
      return load();
    },

    getRoom(roomNumber) {
      const store = load();
      return store.rooms[String(roomNumber).trim()] || null;
    },

    getInspection(roomNumber, inspectionNumber) {
      const room = this.getRoom(roomNumber);
      if (!room) return null;
      return room.inspections[String(inspectionNumber)] || null;
    },

    getInspectionById(id) {
      const store = load();
      const rooms = store.rooms || {};
      for (const rk of Object.keys(rooms)) {
        const room = rooms[rk];
        for (const ik of Object.keys(room.inspections || {})) {
          const insp = room.inspections[ik];
          if (insp && insp.id === id) {
            return { roomNumber: room.roomNumber, inspection: insp };
          }
        }
      }
      return null;
    },

    listRooms() {
      const store = load();
      return Object.keys(store.rooms)
        .map(function (num) {
          const room = store.rooms[num];
          const inspections = Object.keys(room.inspections)
            .map(function (n) {
              return room.inspections[n];
            })
            .sort(function (a, b) {
              return a.inspectionNumber - b.inspectionNumber;
            });
          const latest =
            inspections.slice().sort(function (a, b) {
              return (b.updatedAt || "").localeCompare(a.updatedAt || "");
            })[0] || null;
          const stats = latest ? getInspectionStats(latest) : { defects: 0 };
          return {
            roomNumber: room.roomNumber,
            updatedAt: room.updatedAt,
            latest: latest,
            latestDate: latest ? latest.date : null,
            latestInspectionNumber: latest ? latest.inspectionNumber : null,
            defects: stats.defects,
            status: latest ? latest.status : null,
            inspections: inspections
          };
        })
        .sort(function (a, b) {
          return (b.updatedAt || "").localeCompare(a.updatedAt || "");
        });
    },

    searchRoom(query) {
      const q = String(query || "").trim();
      if (!q) return null;
      return this.getRoom(q);
    },

    getLastActive() {
      return load().lastActive;
    },

    setLastActive(roomNumber, inspectionNumber) {
      const store = load();
      store.lastActive = {
        roomNumber: String(roomNumber),
        inspectionNumber: Number(inspectionNumber)
      };
      save(store);
    },

    clearLastActive() {
      const store = load();
      store.lastActive = null;
      save(store);
    },

    startInspection(roomNumber, options) {
      const opts = options || {};
      const store = load();
      const room = ensureRoom(store, roomNumber);
      const num = opts.isRetest ? 2 : 1;

      if (room.inspections[String(num)]) {
        throw new Error("בדיקה " + num + " כבר קיימת לחדר זה");
      }

      const inspection = createInspection(num, {
        roomType: opts.roomType || "",
        extraId: opts.extraId || ""
      });

      room.inspections[String(num)] = inspection;
      room.updatedAt = new Date().toISOString();
      store.lastActive = {
        roomNumber: room.roomNumber,
        inspectionNumber: num
      };
      save(store);
      notifyChange({
        type: "upsert",
        roomNumber: room.roomNumber,
        inspectionNumber: num,
        inspection: inspection
      });
      return { room: room, inspection: inspection };
    },

    saveInspection(roomNumber, inspectionNumber, patch) {
      const store = load();
      const room = ensureRoom(store, roomNumber);
      const key = String(inspectionNumber);
      let inspection = room.inspections[key];
      if (!inspection) {
        inspection = createInspection(Number(inspectionNumber), patch);
        room.inspections[key] = inspection;
      }
      if (!inspection.id) inspection.id = newId();

      if (patch) {
        if (patch.roomType !== undefined) inspection.roomType = patch.roomType;
        if (patch.extraId !== undefined) inspection.extraId = patch.extraId;
        if (patch.generalNotes !== undefined) inspection.generalNotes = patch.generalNotes;
        if (patch.date !== undefined) inspection.date = patch.date;
        if (patch.status !== undefined) inspection.status = patch.status;
        if (patch.items !== undefined) inspection.items = patch.items;
        if (patch.id !== undefined) inspection.id = patch.id;
        if (patch.legacyKey !== undefined) inspection.legacyKey = patch.legacyKey;
        if (patch.dirty !== undefined) inspection.dirty = patch.dirty;
        if (patch.lastSyncedAt !== undefined) inspection.lastSyncedAt = patch.lastSyncedAt;
        if (patch.itemKey && patch.itemValue) {
          inspection.items[patch.itemKey] = Object.assign(
            {},
            inspection.items[patch.itemKey] || {},
            patch.itemValue
          );
        }
      }

      if (patch && patch.dirty === false) {
        inspection.dirty = false;
        if (!inspection.updatedAt) inspection.updatedAt = new Date().toISOString();
      } else {
        markDirty(inspection);
      }
      room.updatedAt = inspection.updatedAt;
      store.lastActive = {
        roomNumber: room.roomNumber,
        inspectionNumber: Number(inspectionNumber)
      };
      save(store);
      notifyChange({
        type: "upsert",
        roomNumber: room.roomNumber,
        inspectionNumber: Number(inspectionNumber),
        inspection: inspection
      });
      return inspection;
    },

    updateItem(roomNumber, inspectionNumber, itemKey, itemValue) {
      return this.saveInspection(roomNumber, inspectionNumber, {
        itemKey: itemKey,
        itemValue: itemValue
      });
    },

    completeInspection(roomNumber, inspectionNumber) {
      return this.saveInspection(roomNumber, inspectionNumber, {
        status: "completed"
      });
    },

    markSynced(roomNumber, inspectionNumber, serverUpdatedAt) {
      const store = load();
      const room = store.rooms[String(roomNumber)];
      if (!room) return;
      const inspection = room.inspections[String(inspectionNumber)];
      if (!inspection) return;
      inspection.dirty = false;
      inspection.lastSyncedAt = serverUpdatedAt || new Date().toISOString();
      if (serverUpdatedAt) inspection.updatedAt = serverUpdatedAt;
      save(store);
    },

    putRemoteInspection(row, opts) {
      const options = opts || {};
      const store = load();
      const roomNumber = String(row.room_number);
      const inspNum = Number(row.inspection_number);
      const room = ensureRoom(store, roomNumber);
      const existing = room.inspections[String(inspNum)];
      const remoteUpdated = row.updated_at;
      const payload = row.payload || {};

      if (
        existing &&
        existing.dirty &&
        existing.id === row.id &&
        existing.updatedAt &&
        remoteUpdated &&
        existing.updatedAt !== remoteUpdated &&
        existing.lastSyncedAt &&
        remoteUpdated > existing.lastSyncedAt
      ) {
        return { conflict: true, local: existing, remote: row };
      }

      if (existing && existing.dirty && existing.id === row.id && !options.forceRemote) {
        return { conflict: false, skipped: true, inspection: existing };
      }

      const inspection = Object.assign({}, payload, {
        id: row.id,
        inspectionNumber: inspNum,
        date: row.inspection_date || payload.date || todayISO(),
        roomType: row.room_type != null ? row.room_type : payload.roomType || "",
        status: row.status || payload.status || "in_progress",
        createdAt: row.created_at || payload.createdAt,
        updatedAt: remoteUpdated || payload.updatedAt,
        dirty: false,
        lastSyncedAt: remoteUpdated || null,
        legacyKey: payload.legacyKey || null,
        extraId: payload.extraId || "",
        generalNotes: payload.generalNotes || "",
        items: payload.items || createEmptyItems()
      });

      room.inspections[String(inspNum)] = inspection;
      room.updatedAt = inspection.updatedAt;
      save(store);
      return { conflict: false, inspection: inspection };
    },

    addSafeConflictCopy(roomNumber, inspectionNumber, remoteRow) {
      const copyRoom = String(roomNumber) + " (עותק שרת)";
      const store = load();
      const room = ensureRoom(store, copyRoom);
      const payload = (remoteRow && remoteRow.payload) || {};
      const inspNum = Number(inspectionNumber);
      const inspection = Object.assign({}, payload, {
        id: newId(),
        inspectionNumber: inspNum,
        date: remoteRow.inspection_date || payload.date,
        roomType: remoteRow.room_type || payload.roomType || "",
        status: remoteRow.status || payload.status || "in_progress",
        createdAt: remoteRow.created_at || payload.createdAt,
        updatedAt: remoteRow.updated_at || payload.updatedAt,
        dirty: false,
        lastSyncedAt: null,
        extraId: payload.extraId || "",
        generalNotes: payload.generalNotes || "",
        items: payload.items || createEmptyItems(),
        isServerConflictCopy: true,
        sourceInspectionId: remoteRow.id
      });
      room.inspections[String(inspNum)] = inspection;
      room.updatedAt = inspection.updatedAt;
      save(store);
      return copyRoom;
    },

    deleteInspection(roomNumber, inspectionNumber) {
      const store = load();
      const room = store.rooms[String(roomNumber)];
      if (!room) return null;
      const inspection = room.inspections[String(inspectionNumber)] || null;
      const deletedId = inspection && inspection.id ? inspection.id : null;
      delete room.inspections[String(inspectionNumber)];
      if (Object.keys(room.inspections).length === 0) {
        delete store.rooms[String(roomNumber)];
      } else {
        room.updatedAt = new Date().toISOString();
      }
      if (
        store.lastActive &&
        store.lastActive.roomNumber === String(roomNumber) &&
        Number(store.lastActive.inspectionNumber) === Number(inspectionNumber)
      ) {
        store.lastActive = null;
      }
      save(store);
      notifyChange({
        type: "delete",
        roomNumber: String(roomNumber),
        inspectionNumber: Number(inspectionNumber),
        id: deletedId
      });
      return deletedId;
    },

    deleteRoom(roomNumber) {
      const store = load();
      const room = store.rooms[String(roomNumber)];
      const ids = [];
      if (room) {
        Object.keys(room.inspections || {}).forEach(function (k) {
          const insp = room.inspections[k];
          if (insp && insp.id) ids.push(insp.id);
        });
      }
      delete store.rooms[String(roomNumber)];
      if (store.lastActive && store.lastActive.roomNumber === String(roomNumber)) {
        store.lastActive = null;
      }
      save(store);
      ids.forEach(function (id) {
        notifyChange({ type: "delete", id: id, roomNumber: String(roomNumber) });
      });
      return ids;
    },

    getInProgressInspections() {
      const rooms = this.listRooms();
      const list = [];
      for (const room of rooms) {
        for (const insp of room.inspections) {
          if (insp.status === "in_progress") {
            list.push({
              roomNumber: room.roomNumber,
              inspection: insp,
              stats: getInspectionStats(insp)
            });
          }
        }
      }
      return list.sort(function (a, b) {
        return (b.inspection.updatedAt || "").localeCompare(a.inspection.updatedAt || "");
      });
    },

    listDirtyInspections() {
      const store = load();
      const out = [];
      Object.keys(store.rooms || {}).forEach(function (rk) {
        const room = store.rooms[rk];
        Object.keys(room.inspections || {}).forEach(function (ik) {
          const insp = room.inspections[ik];
          if (insp && insp.dirty && !insp.isServerConflictCopy) {
            out.push({ roomNumber: room.roomNumber, inspection: insp });
          }
        });
      });
      return out;
    },

    getStats: getInspectionStats,
    getMissingDefectNotes: listMissingDefectNotes
  };

  global.Storage = Storage;
})(window);
