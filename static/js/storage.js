/**
 * Persistent storage for room inspections (localStorage).
 * Each room keeps all inspections (1 and 2) separately — never overwrite.
 */
(function (global) {
  const STORAGE_KEY = "yacht-room-inspections-v1";

  function emptyStore() {
    return {
      rooms: {},
      lastActive: null,
      version: 1
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyStore();
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return emptyStore();
      if (!data.rooms) data.rooms = {};
      return data;
    } catch (e) {
      console.error("Failed to load store", e);
      return emptyStore();
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
      inspectionNumber: inspectionNumber,
      date: todayISO(),
      roomType: (meta && meta.roomType) || "",
      extraId: (meta && meta.extraId) || "",
      generalNotes: "",
      status: "in_progress",
      items: createEmptyItems(),
      createdAt: now,
      updatedAt: now
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

      if (meta.item.optionalExists && row.exists === false) {
        continue;
      }
      if (meta.item.optionalExists && row.exists !== true) {
        continue;
      }

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

  const Storage = {
    todayISO,
    formatDisplayDate,
    formatFileDate,

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

    listRooms() {
      const store = load();
      return Object.keys(store.rooms)
        .map((num) => {
          const room = store.rooms[num];
          const inspections = Object.keys(room.inspections)
            .map((n) => room.inspections[n])
            .sort((a, b) => a.inspectionNumber - b.inspectionNumber);
          const latest =
            inspections.slice().sort((a, b) => {
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
        .sort((a, b) => {
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
      return { room, inspection };
    },

    /**
     * Upsert current working inspection fields (auto-save).
     */
    saveInspection(roomNumber, inspectionNumber, patch) {
      const store = load();
      const room = ensureRoom(store, roomNumber);
      const key = String(inspectionNumber);
      let inspection = room.inspections[key];
      if (!inspection) {
        inspection = createInspection(Number(inspectionNumber), patch);
        room.inspections[key] = inspection;
      }

      if (patch) {
        if (patch.roomType !== undefined) inspection.roomType = patch.roomType;
        if (patch.extraId !== undefined) inspection.extraId = patch.extraId;
        if (patch.generalNotes !== undefined) inspection.generalNotes = patch.generalNotes;
        if (patch.date !== undefined) inspection.date = patch.date;
        if (patch.status !== undefined) inspection.status = patch.status;
        if (patch.items !== undefined) inspection.items = patch.items;
        if (patch.itemKey && patch.itemValue) {
          inspection.items[patch.itemKey] = Object.assign(
            {},
            inspection.items[patch.itemKey] || {},
            patch.itemValue
          );
        }
      }

      inspection.updatedAt = new Date().toISOString();
      room.updatedAt = inspection.updatedAt;
      store.lastActive = {
        roomNumber: room.roomNumber,
        inspectionNumber: Number(inspectionNumber)
      };
      save(store);
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

    deleteInspection(roomNumber, inspectionNumber) {
      const store = load();
      const room = store.rooms[String(roomNumber)];
      if (!room) return;
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
    },

    deleteRoom(roomNumber) {
      const store = load();
      delete store.rooms[String(roomNumber)];
      if (store.lastActive && store.lastActive.roomNumber === String(roomNumber)) {
        store.lastActive = null;
      }
      save(store);
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
      return list.sort((a, b) =>
        (b.inspection.updatedAt || "").localeCompare(a.inspection.updatedAt || "")
      );
    },

    getStats: getInspectionStats,
    getMissingDefectNotes: listMissingDefectNotes
  };

  global.Storage = Storage;
})(window);
