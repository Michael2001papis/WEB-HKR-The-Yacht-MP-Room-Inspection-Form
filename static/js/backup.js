/**
 * Backup export/import layer — does NOT replace localStorage auto-save.
 * Merge keeps local data; conflicts keep both (local + imported copy).
 */
(function (global) {
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function stampLabel(d) {
    const x = d || new Date();
    return (
      pad(x.getDate()) +
      "-" +
      pad(x.getMonth() + 1) +
      "-" +
      x.getFullYear() +
      "-" +
      pad(x.getHours()) +
      "-" +
      pad(x.getMinutes())
    );
  }

  function backupFileName(d) {
    return "WEB-HKR-Room-Inspection-Backup-" + stampLabel(d) + ".json";
  }

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function stableInspectionPayload(insp) {
    if (!insp) return null;
    return {
      inspectionNumber: insp.inspectionNumber,
      date: insp.date,
      roomType: insp.roomType || "",
      extraId: insp.extraId || "",
      generalNotes: insp.generalNotes || "",
      status: insp.status,
      items: insp.items || {}
    };
  }

  function inspectionsEqual(a, b) {
    return (
      JSON.stringify(stableInspectionPayload(a)) ===
      JSON.stringify(stableInspectionPayload(b))
    );
  }

  function uid() {
    return (
      "c-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function parseBackupFile(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") {
      throw new Error("קובץ גיבוי לא תקין");
    }
    // Accept wrapped format or raw store
    if (parsed.data && parsed.data.rooms) return parsed;
    if (parsed.rooms) {
      return {
        app: "WEB-HKR-The-Yacht-MP-Room-Inspection-Form",
        type: "full-backup",
        version: 1,
        exportedAt: null,
        data: parsed
      };
    }
    throw new Error("קובץ גיבוי לא מזוהה");
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 2000);
  }

  const Backup = {
    backupFileName: backupFileName,

    buildExportObject() {
      const now = new Date();
      return {
        app: "WEB-HKR-The-Yacht-MP-Room-Inspection-Form",
        type: "full-backup",
        version: 1,
        exportedAt: now.toISOString(),
        exportedAtLabel: stampLabel(now),
        data: clone(global.Storage.getAll())
      };
    },

    exportFull() {
      const payload = this.buildExportObject();
      const name = backupFileName(new Date());
      downloadJson(name, payload);
      return { filename: name, payload: payload };
    },

    /** Safety download of current local data before risky import. */
    exportSafetyCopy() {
      const payload = this.buildExportObject();
      payload.type = "safety-before-import";
      const name =
        "WEB-HKR-Room-Inspection-Safety-Before-Import-" +
        stampLabel(new Date()) +
        ".json";
      downloadJson(name, payload);
      return { filename: name };
    },

    /**
     * Merge imported backup into local store.
     * - New rooms/inspections are added
     * - Identical inspections are skipped
     * - Different same-number inspections: keep local, store imported in conflictCopies
     */
    mergeFromBackup(backupObj) {
      const incoming = parseBackupFile(
        typeof backupObj === "string" ? backupObj : JSON.stringify(backupObj)
      );
      const remote = incoming.data || {};
      const local = clone(global.Storage.getAll());
      if (!local.rooms) local.rooms = {};
      if (!remote.rooms) remote.rooms = {};

      const summary = {
        roomsAdded: 0,
        inspectionsAdded: 0,
        inspectionsSkippedSame: 0,
        conflictsKeptBoth: 0,
        conflictDetails: []
      };

      Object.keys(remote.rooms).forEach(function (roomNum) {
        const remoteRoom = remote.rooms[roomNum];
        if (!remoteRoom) return;

        if (!local.rooms[roomNum]) {
          local.rooms[roomNum] = clone(remoteRoom);
          if (!local.rooms[roomNum].conflictCopies) {
            local.rooms[roomNum].conflictCopies = [];
          }
          // Move any remote conflictCopies too
          summary.roomsAdded++;
          const inspCount = Object.keys(remoteRoom.inspections || {}).length;
          summary.inspectionsAdded += inspCount;
          return;
        }

        const localRoom = local.rooms[roomNum];
        if (!localRoom.inspections) localRoom.inspections = {};
        if (!Array.isArray(localRoom.conflictCopies)) localRoom.conflictCopies = [];

        // Merge remote conflict copies as additional conflict copies (never drop)
        if (Array.isArray(remoteRoom.conflictCopies)) {
          remoteRoom.conflictCopies.forEach(function (cc) {
            localRoom.conflictCopies.push(clone(cc));
          });
        }

        Object.keys(remoteRoom.inspections || {}).forEach(function (inspKey) {
          const remoteInsp = remoteRoom.inspections[inspKey];
          const localInsp = localRoom.inspections[inspKey];

          if (!localInsp) {
            localRoom.inspections[inspKey] = clone(remoteInsp);
            summary.inspectionsAdded++;
            localRoom.updatedAt = new Date().toISOString();
            return;
          }

          if (inspectionsEqual(localInsp, remoteInsp)) {
            summary.inspectionsSkippedSame++;
            return;
          }

          // Conflict: keep local, keep imported as conflict copy
          localRoom.conflictCopies.push({
            id: uid(),
            originalInspectionNumber: remoteInsp.inspectionNumber || Number(inspKey) || inspKey,
            importedAt: new Date().toISOString(),
            source: "import-merge",
            label: "עותק מיובא — לא דרס את הגרסה המקומית",
            inspection: clone(remoteInsp)
          });
          summary.conflictsKeptBoth++;
          summary.conflictDetails.push({
            roomNumber: roomNum,
            inspectionNumber: remoteInsp.inspectionNumber || inspKey
          });
          localRoom.updatedAt = new Date().toISOString();
        });
      });

      global.Storage.writeAll(local);
      return summary;
    },

    readFileAsText(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          resolve(String(reader.result || ""));
        };
        reader.onerror = function () {
          reject(new Error("קריאת הקובץ נכשלה"));
        };
        reader.readAsText(file, "utf-8");
      });
    }
  };

  global.Backup = Backup;
})(window);
