/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001 | Release V0.02.0
 * Offline-first sync engine: local cache → Supabase (primary).
 * Queue + pull/push. Never deletes legacy localStorage key.
 */
(function (global) {
  const QUEUE_PREFIX = "yacht-sync-queue-v1:";
  const MIG_PREFIX = "yacht-migration-state-v1:";
  const STATUS_PREFIX = "yacht-sync-status-v1:";

  let syncTimer = null;
  let syncing = false;
  let statusListeners = [];
  let lastStatus = { state: "idle", message: "" };
  let initialized = false;
  let migrating = false;

  function userId() {
    return global.Storage && global.Storage.getActiveUser
      ? global.Storage.getActiveUser()
      : null;
  }

  function queueKey() {
    const uid = userId();
    return uid ? QUEUE_PREFIX + uid : null;
  }

  function migKey() {
    const uid = userId();
    return uid ? MIG_PREFIX + uid : null;
  }

  function statusKey() {
    const uid = userId();
    return uid ? STATUS_PREFIX + uid : null;
  }

  function loadJson(key, fallback) {
    if (!key) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadQueue() {
    return loadJson(queueKey(), { upserts: {}, deletes: {} });
  }

  function saveQueue(q) {
    saveJson(queueKey(), q);
  }

  function loadMigrationState() {
    return loadJson(migKey(), {
      status: "none",
      migratedLegacyKeys: {},
      lastError: null
    });
  }

  function saveMigrationState(state) {
    saveJson(migKey(), state);
  }

  function setStatus(state, message) {
    lastStatus = { state: state, message: message || "" };
    const key = statusKey();
    if (key) saveJson(key, lastStatus);
    statusListeners.forEach(function (fn) {
      try {
        fn(lastStatus);
      } catch (e) {
        console.error(e);
      }
    });
  }

  function isOnline() {
    return typeof navigator === "undefined" ? true : navigator.onLine !== false;
  }

  function buildPayload(inspection) {
    return {
      id: inspection.id,
      inspectionNumber: inspection.inspectionNumber,
      date: inspection.date,
      roomType: inspection.roomType || "",
      extraId: inspection.extraId || "",
      generalNotes: inspection.generalNotes || "",
      status: inspection.status,
      items: inspection.items || {},
      createdAt: inspection.createdAt,
      updatedAt: inspection.updatedAt,
      legacyKey: inspection.legacyKey || null
    };
  }

  function toRow(roomNumber, inspection, uid) {
    return {
      id: inspection.id,
      user_id: uid,
      room_number: String(roomNumber),
      room_type: inspection.roomType || "",
      inspection_number: Number(inspection.inspectionNumber),
      inspection_date: inspection.date || null,
      status: inspection.status || "in_progress",
      payload: buildPayload(inspection),
      created_at: inspection.createdAt || new Date().toISOString(),
      updated_at: inspection.updatedAt || new Date().toISOString()
    };
  }

  function enqueueUpsert(roomNumber, inspection) {
    if (!inspection || !inspection.id || inspection.isServerConflictCopy) return;
    const q = loadQueue();
    q.upserts[inspection.id] = {
      roomNumber: String(roomNumber),
      inspectionNumber: Number(inspection.inspectionNumber),
      id: inspection.id,
      updatedAt: inspection.updatedAt
    };
    delete q.deletes[inspection.id];
    saveQueue(q);
  }

  function enqueueDelete(id) {
    if (!id) return;
    const q = loadQueue();
    delete q.upserts[id];
    q.deletes[id] = { id: id, at: new Date().toISOString() };
    saveQueue(q);
  }

  async function pushOne(client, uid, roomNumber, inspection) {
    const row = toRow(roomNumber, inspection, uid);

    const { data: existing, error: fetchErr } = await client
      .from("inspections")
      .select(
        "id, updated_at, payload, room_number, room_type, inspection_number, inspection_date, status, created_at"
      )
      .eq("id", inspection.id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (
      existing &&
      inspection.lastSyncedAt &&
      existing.updated_at &&
      existing.updated_at > inspection.lastSyncedAt &&
      inspection.dirty &&
      existing.updated_at !== inspection.updatedAt
    ) {
      return { conflict: true, remote: existing };
    }

    const { data, error } = await client
      .from("inspections")
      .upsert(row, { onConflict: "id" })
      .select("id, updated_at")
      .single();

    if (error) throw error;
    return { conflict: false, data: data };
  }

  async function processQueue() {
    if (syncing) return lastStatus;
    const uid = userId();
    if (!uid || !global.Auth || !global.Auth.isLoggedIn()) return lastStatus;
    if (!global.SupabaseApp || !global.SupabaseApp.isConfigured()) return lastStatus;

    if (!isOnline()) {
      setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
      return lastStatus;
    }

    syncing = true;
    setStatus("saving", "שומר…");

    try {
      const client = global.SupabaseApp.getClient();
      const q = loadQueue();
      const deleteIds = Object.keys(q.deletes || {});
      const upsertIds = Object.keys(q.upserts || {});

      for (let i = 0; i < deleteIds.length; i++) {
        const id = deleteIds[i];
        const { error } = await client.from("inspections").delete().eq("id", id);
        if (error) throw error;
        delete q.deletes[id];
        saveQueue(q);
      }

      for (let i = 0; i < upsertIds.length; i++) {
        const id = upsertIds[i];
        const meta = q.upserts[id];
        if (!meta) continue;
        const found = global.Storage.getInspectionById(id);
        if (!found || !found.inspection) {
          delete q.upserts[id];
          saveQueue(q);
          continue;
        }
        const result = await pushOne(client, uid, found.roomNumber, found.inspection);
        if (result.conflict) {
          const copyRoom = global.Storage.addSafeConflictCopy(
            found.roomNumber,
            found.inspection.inspectionNumber,
            result.remote
          );
          setStatus("error", "השמירה נכשלה – הנתונים נשמרו זמנית במכשיר");
          if (typeof global.onSyncConflict === "function") {
            global.onSyncConflict({
              roomNumber: found.roomNumber,
              inspectionNumber: found.inspection.inspectionNumber,
              copyRoom: copyRoom
            });
          }
          continue;
        }
        global.Storage.markSynced(
          found.roomNumber,
          found.inspection.inspectionNumber,
          result.data && result.data.updated_at
        );
        delete q.upserts[id];
        saveQueue(q);
      }

      const dirty = global.Storage.listDirtyInspections();
      for (let i = 0; i < dirty.length; i++) {
        const item = dirty[i];
        enqueueUpsert(item.roomNumber, item.inspection);
      }
      const q2 = loadQueue();
      const ids = Object.keys(q2.upserts || {});
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const found = global.Storage.getInspectionById(id);
        if (!found) {
          delete q2.upserts[id];
          continue;
        }
        const result = await pushOne(client, uid, found.roomNumber, found.inspection);
        if (result.conflict) continue;
        global.Storage.markSynced(
          found.roomNumber,
          found.inspection.inspectionNumber,
          result.data && result.data.updated_at
        );
        delete q2.upserts[id];
      }
      saveQueue(q2);

      const finalQ = loadQueue();
      const pending =
        Object.keys(finalQ.upserts || {}).length +
        Object.keys(finalQ.deletes || {}).length;
      if (pending > 0) {
        setStatus("pending", "ממתין לסנכרון");
      } else {
        setStatus("saved", "נשמר באתר");
      }
    } catch (e) {
      console.error("Sync failed", e);
      if (!isOnline()) {
        setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
      } else {
        setStatus("error", "השמירה נכשלה – הנתונים נשמרו זמנית במכשיר");
      }
    } finally {
      syncing = false;
    }
    return lastStatus;
  }

  function scheduleSync(delay) {
    clearTimeout(syncTimer);
    const q = loadQueue();
    const pending =
      Object.keys(q.upserts || {}).length + Object.keys(q.deletes || {}).length;
    const dirty = global.Storage.listDirtyInspections
      ? global.Storage.listDirtyInspections().length
      : 0;
    if (pending || dirty) {
      if (!isOnline()) setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
      else setStatus("pending", "ממתין לסנכרון");
    }
    syncTimer = setTimeout(function () {
      processQueue();
    }, delay == null ? 400 : delay);
  }

  async function pullAll() {
    const uid = userId();
    if (!uid) return { ok: false, reason: "no-user" };
    if (!isOnline()) {
      setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
      return { ok: false, reason: "offline" };
    }
    setStatus("saving", "שומר…");
    try {
      const client = global.SupabaseApp.getClient();
      const { data, error } = await client
        .from("inspections")
        .select("*")
        .eq("user_id", uid)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const conflicts = [];
      (data || []).forEach(function (row) {
        const result = global.Storage.putRemoteInspection(row);
        if (result.conflict) {
          const copyRoom = global.Storage.addSafeConflictCopy(
            row.room_number,
            row.inspection_number,
            row
          );
          conflicts.push({
            roomNumber: row.room_number,
            inspectionNumber: row.inspection_number,
            copyRoom: copyRoom
          });
        }
      });

      await processQueue();
      return { ok: true, count: (data || []).length, conflicts: conflicts };
    } catch (e) {
      console.error("Pull failed", e);
      setStatus("error", "השמירה נכשלה – הנתונים נשמרו זמנית במכשיר");
      return { ok: false, error: e };
    }
  }

  function onLocalChange(detail) {
    if (migrating) return;
    if (!userId()) return;
    if (!detail) return;
    if (detail.type === "upsert" && detail.inspection) {
      if (detail.inspection.isServerConflictCopy) return;
      enqueueUpsert(detail.roomNumber, detail.inspection);
      if (!isOnline()) {
        setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
      } else {
        setStatus("saving", "שומר…");
        scheduleSync(450);
      }
    } else if (detail.type === "delete") {
      if (detail.id) enqueueDelete(detail.id);
      if (!isOnline()) {
        setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
      } else {
        setStatus("saving", "שומר…");
        scheduleSync(200);
      }
    }
  }

  function countLegacyForPrompt() {
    return global.Storage.countLegacy();
  }

  function shouldOfferMigration() {
    const counts = countLegacyForPrompt();
    if (!counts.rooms && !counts.inspections) return false;
    const state = loadMigrationState();
    if (state.status === "done") return false;
    return true;
  }

  async function migrateLegacy(onProgress) {
    const uid = userId();
    if (!uid) throw new Error("לא מחובר");
    migrating = true;
    const legacy = global.Storage.getLegacyStore();
    const state = loadMigrationState();
    if (!state.migratedLegacyKeys) state.migratedLegacyKeys = {};
    state.status = "in_progress";
    state.lastError = null;
    saveMigrationState(state);

    const rooms = legacy.rooms || {};
    const roomKeys = Object.keys(rooms);
    let total = 0;
    let done = 0;
    roomKeys.forEach(function (rk) {
      total += Object.keys(rooms[rk].inspections || {}).length;
    });

    if (typeof onProgress === "function") {
      onProgress({ done: done, total: total });
    }

    if (!isOnline()) {
      state.lastError = "offline";
      saveMigrationState(state);
      migrating = false;
      throw new Error("אין אינטרנט – ההעברה תושהה");
    }

    const client = global.SupabaseApp.getClient();

    for (let r = 0; r < roomKeys.length; r++) {
      const roomNumber = roomKeys[r];
      const room = rooms[roomNumber];
      const inspKeys = Object.keys(room.inspections || {});
      for (let i = 0; i < inspKeys.length; i++) {
        const inspKey = inspKeys[i];
        const legacyInsp = room.inspections[inspKey];
        const legacyKey = String(roomNumber) + ":" + String(inspKey);

        if (state.migratedLegacyKeys[legacyKey]) {
          done++;
          if (typeof onProgress === "function") onProgress({ done: done, total: total });
          continue;
        }

        const existingLocal = global.Storage.getInspection(roomNumber, inspKey);
        if (existingLocal && existingLocal.id && existingLocal.legacyKey !== legacyKey) {
          state.migratedLegacyKeys[legacyKey] = existingLocal.id;
          saveMigrationState(state);
          done++;
          if (typeof onProgress === "function") onProgress({ done: done, total: total });
          continue;
        }

        let id = (existingLocal && existingLocal.id) || global.Storage.newId();
        if (existingLocal && existingLocal.legacyKey === legacyKey) {
          id = existingLocal.id;
        }

        const inspection = {
          id: id,
          inspectionNumber: Number(legacyInsp.inspectionNumber || inspKey),
          date: legacyInsp.date,
          roomType: legacyInsp.roomType || "",
          extraId: legacyInsp.extraId || "",
          generalNotes: legacyInsp.generalNotes || "",
          status: legacyInsp.status || "in_progress",
          items: legacyInsp.items || {},
          createdAt: legacyInsp.createdAt || new Date().toISOString(),
          updatedAt: legacyInsp.updatedAt || new Date().toISOString(),
          dirty: true,
          lastSyncedAt: null,
          legacyKey: legacyKey
        };

        global.Storage.saveInspection(roomNumber, inspection.inspectionNumber, {
          id: inspection.id,
          roomType: inspection.roomType,
          extraId: inspection.extraId,
          generalNotes: inspection.generalNotes,
          date: inspection.date,
          status: inspection.status,
          items: inspection.items,
          legacyKey: legacyKey
        });

        const store = global.Storage.getAll();
        if (
          store.rooms[roomNumber] &&
          store.rooms[roomNumber].inspections[String(inspKey)]
        ) {
          store.rooms[roomNumber].inspections[String(inspKey)].id = id;
          store.rooms[roomNumber].inspections[String(inspKey)].legacyKey = legacyKey;
          global.Storage.replaceStore(store);
        }

        const current = global.Storage.getInspection(roomNumber, inspection.inspectionNumber);
        const row = toRow(roomNumber, current || inspection, uid);

        try {
          const { error } = await client.from("inspections").upsert(row, {
            onConflict: "id"
          });
          if (error) throw error;
          global.Storage.markSynced(
            roomNumber,
            inspection.inspectionNumber,
            row.updated_at
          );
          state.migratedLegacyKeys[legacyKey] = row.id;
          saveMigrationState(state);
          done++;
          if (typeof onProgress === "function") onProgress({ done: done, total: total });
        } catch (e) {
          state.lastError = (e && e.message) || String(e);
          saveMigrationState(state);
          migrating = false;
          throw e;
        }
      }
    }

    const { data: remoteRows, error: verifyErr } = await client
      .from("inspections")
      .select("id, payload")
      .eq("user_id", uid);
    if (verifyErr) {
      migrating = false;
      throw verifyErr;
    }

    const migratedCount = Object.keys(state.migratedLegacyKeys).length;
    if (migratedCount < total) {
      state.status = "in_progress";
      state.lastError = "incomplete";
      saveMigrationState(state);
      migrating = false;
      return {
        ok: false,
        incomplete: true,
        done: migratedCount,
        total: total
      };
    }

    state.status = "done";
    state.lastError = null;
    saveMigrationState(state);
    migrating = false;

    return {
      ok: true,
      done: migratedCount,
      total: total,
      remote: (remoteRows || []).length
    };
  }

  function getMigrationState() {
    return loadMigrationState();
  }

  function getStatus() {
    return lastStatus;
  }

  function onStatus(fn) {
    statusListeners = [fn];
  }

  function bindNetwork() {
    window.addEventListener("online", function () {
      setStatus("pending", "ממתין לסנכרון");
      scheduleSync(300);
    });
    window.addEventListener("offline", function () {
      setStatus("offline", "אין אינטרנט – נשמר זמנית במכשיר");
    });
  }

  function init() {
    if (initialized) return;
    initialized = true;
    if (global.Storage && global.Storage.onChange) {
      global.Storage.onChange(onLocalChange);
    }
    bindNetwork();
  }

  global.SyncEngine = {
    init: init,
    scheduleSync: scheduleSync,
    processQueue: processQueue,
    pullAll: pullAll,
    shouldOfferMigration: shouldOfferMigration,
    migrateLegacy: migrateLegacy,
    getMigrationState: getMigrationState,
    countLegacyForPrompt: countLegacyForPrompt,
    getStatus: getStatus,
    onStatus: onStatus,
    setStatus: setStatus,
    isOnline: isOnline
  };
})(window);
