/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001
 * Main application UI and navigation.
 */
(function () {
  const screens = {};
  let saveTimer = null;
  let saveState = "idle"; // idle | saving | saved
  let current = {
    roomNumber: null,
    inspectionNumber: null,
    inspection: null
  };
  let openCategories = {};
  let fastScanEnabled = true;

  function $(id) {
    return document.getElementById(id);
  }

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  function showScreen(name) {
    qsa(".screen").forEach(function (el) {
      el.classList.toggle("is-active", el.dataset.screen === name);
    });
    document.body.classList.toggle("is-auth", name === "auth");
    document.body.classList.toggle("is-app", name !== "auth");
    window.scrollTo(0, 0);
  }

  function setSaveIndicator(state, customText) {
    saveState = state;
    const el = $("save-indicator");
    if (!el) return;
    el.classList.remove(
      "is-saving",
      "is-saved",
      "is-hidden",
      "is-offline",
      "is-pending",
      "is-error"
    );
    if (state === "saving") {
      el.textContent = customText || "שומר…";
      el.classList.add("is-saving");
    } else if (state === "saved") {
      el.textContent = customText || "נשמר באתר";
      el.classList.add("is-saved");
      clearTimeout(setSaveIndicator._hideTimer);
      setSaveIndicator._hideTimer = setTimeout(function () {
        if (saveState === "saved") setSaveIndicator("idle");
      }, 1600);
    } else if (state === "offline") {
      el.textContent = customText || "אין אינטרנט – נשמר זמנית במכשיר";
      el.classList.add("is-offline");
    } else if (state === "pending") {
      el.textContent = customText || "ממתין לסנכרון";
      el.classList.add("is-pending");
    } else if (state === "error") {
      el.textContent =
        customText || "השמירה נכשלה – הנתונים נשמרו זמנית במכשיר";
      el.classList.add("is-error");
    } else {
      el.classList.add("is-hidden");
    }
  }

  function applySyncStatus(status) {
    if (!status || !status.state) return;
    if (status.state === "saving") setSaveIndicator("saving", status.message);
    else if (status.state === "saved") setSaveIndicator("saved", status.message);
    else if (status.state === "offline") setSaveIndicator("offline", status.message);
    else if (status.state === "pending") setSaveIndicator("pending", status.message);
    else if (status.state === "error") setSaveIndicator("error", status.message);
  }

  function scheduleSave(mutator) {
    if (!current.roomNumber || !current.inspectionNumber) return;
    setSaveIndicator("saving");
    if (typeof mutator === "function") mutator();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      persistCurrent();
    }, 180);
  }

  function persistCurrent() {
    if (!current.roomNumber || !current.inspection) return;
    Storage.saveInspection(current.roomNumber, current.inspectionNumber, {
      roomType: current.inspection.roomType,
      extraId: current.inspection.extraId,
      generalNotes: current.inspection.generalNotes || "",
      date: current.inspection.date,
      status: current.inspection.status,
      items: current.inspection.items
    });
  }

  function loadCurrent(roomNumber, inspectionNumber) {
    const insp = Storage.getInspection(roomNumber, inspectionNumber);
    if (!insp) return false;
    current.roomNumber = String(roomNumber);
    current.inspectionNumber = Number(inspectionNumber);
    current.inspection = JSON.parse(JSON.stringify(insp));
    Storage.setLastActive(current.roomNumber, current.inspectionNumber);
    return true;
  }

  /* ---------- Home ---------- */
  function renderHome() {
    showScreen("home");
    const sub = $("home-sub");
    if (sub) {
      if (Auth.isCloudConnected && Auth.isCloudConnected()) {
        sub.textContent = "הנתונים מסונכרנים בין המכשירים";
      } else {
        sub.textContent = "בחרו פעולה — הכל נשמר אוטומטית במכשיר";
      }
    }

    const banner = $("continue-banner");
    const last = Storage.getLastActive();
    if (last && Storage.getInspection(last.roomNumber, last.inspectionNumber)) {
      const insp = Storage.getInspection(last.roomNumber, last.inspectionNumber);
      banner.classList.remove("is-hidden");
      banner.innerHTML =
        '<div class="banner-text">' +
        "<strong>להמשיך מחדר " +
        escapeHtml(last.roomNumber) +
        "?</strong>" +
        "<span>בדיקה " +
        escapeHtml(String(last.inspectionNumber)) +
        " · " +
        (insp.status === "completed" ? "הושלמה" : "בתהליך") +
        "</span></div>" +
        '<button type="button" class="btn btn-primary" id="btn-resume-last">המשך</button>';
      $("btn-resume-last").onclick = function () {
        openInspection(last.roomNumber, last.inspectionNumber);
      };
    } else {
      banner.classList.add("is-hidden");
      banner.innerHTML = "";
    }

    const inProgress = Storage.getInProgressInspections();
    const countEl = $("in-progress-count");
    if (countEl) {
      countEl.textContent = inProgress.length ? String(inProgress.length) : "";
      countEl.classList.toggle("is-hidden", !inProgress.length);
    }
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- New inspection ---------- */
  function openNewInspectionForm() {
    showScreen("new-inspection");
    $("new-room-number").value = "";
    $("new-room-type").value = "";
    $("new-extra-id").value = "";
    $("new-is-retest").checked = false;
    $("new-inspection-number-label").textContent = "בדיקה 1";
    $("new-date").value = Storage.formatDisplayDate(Storage.todayISO());
    $("new-error").textContent = "";
    $("new-room-number").focus();
  }

  function updateRetestLabel() {
    const isRetest = $("new-is-retest").checked;
    $("new-inspection-number-label").textContent = isRetest ? "בדיקה 2" : "בדיקה 1";
  }

  function startNewInspection() {
    const roomNumber = $("new-room-number").value.trim();
    const err = $("new-error");
    err.textContent = "";
    if (!roomNumber) {
      err.textContent = "יש להזין מספר חדר לפני תחילת הבדיקה.";
      $("new-room-number").focus();
      return;
    }

    const isRetest = $("new-is-retest").checked;
    const existing = Storage.getInspection(roomNumber, isRetest ? 2 : 1);
    if (existing) {
      err.textContent =
        "בדיקה " +
        (isRetest ? "2" : "1") +
        " כבר קיימת לחדר " +
        roomNumber +
        ". ניתן לפתוח אותה ממסך החדרים השמורים או החיפוש.";
      return;
    }

    try {
      const result = Storage.startInspection(roomNumber, {
        isRetest: isRetest,
        roomType: $("new-room-type").value.trim(),
        extraId: $("new-extra-id").value.trim()
      });
      openCategories = {};
      openInspection(result.room.roomNumber, result.inspection.inspectionNumber);
    } catch (e) {
      err.textContent = e.message || "לא ניתן להתחיל בדיקה";
    }
  }

  /* ---------- Continue ---------- */
  function openContinueList() {
    showScreen("continue");
    const list = $("continue-list");
    const items = Storage.getInProgressInspections();
    if (!items.length) {
      list.innerHTML =
        '<div class="empty-state">אין בדיקות בתהליך. ניתן לפתוח בדיקת חדר חדשה.</div>';
      return;
    }
    list.innerHTML = items
      .map(function (row) {
        return (
          '<button type="button" class="list-card" data-room="' +
          escapeHtml(row.roomNumber) +
          '" data-insp="' +
          row.inspection.inspectionNumber +
          '">' +
          '<div class="list-card-title">חדר ' +
          escapeHtml(row.roomNumber) +
          "</div>" +
          '<div class="list-card-meta">בדיקה ' +
          row.inspection.inspectionNumber +
          " · " +
          Storage.formatDisplayDate(row.inspection.date) +
          " · ליקויים: " +
          row.stats.defects +
          "</div>" +
          "</button>"
        );
      })
      .join("");

    qsa("[data-room]", list).forEach(function (btn) {
      btn.onclick = function () {
        openInspection(btn.dataset.room, btn.dataset.insp);
      };
    });
  }

  /* ---------- Saved rooms ---------- */
  function openSavedRooms() {
    showScreen("saved-rooms");
    const list = $("saved-rooms-list");
    const rooms = Storage.listRooms();
    if (!rooms.length) {
      list.innerHTML = '<div class="empty-state">עדיין לא נשמרו חדרים.</div>';
      return;
    }
    list.innerHTML = rooms
      .map(function (room) {
        const statusLabel =
          room.status === "completed"
            ? "הושלמה"
            : room.status === "in_progress"
              ? "בתהליך"
              : "—";
        return (
          '<button type="button" class="list-card" data-open-room="' +
          escapeHtml(room.roomNumber) +
          '">' +
          '<div class="list-card-top">' +
          '<div class="list-card-title">חדר ' +
          escapeHtml(room.roomNumber) +
          "</div>" +
          '<span class="status-pill status-' +
          (room.status || "none") +
          '">' +
          statusLabel +
          "</span></div>" +
          '<div class="list-card-meta">תאריך אחרון: ' +
          Storage.formatDisplayDate(room.latestDate) +
          " · בדיקה " +
          (room.latestInspectionNumber || "—") +
          " · ליקויים: " +
          room.defects +
          "</div>" +
          "</button>"
        );
      })
      .join("");

    qsa("[data-open-room]", list).forEach(function (btn) {
      btn.onclick = function () {
        openRoomDetail(btn.dataset.openRoom);
      };
    });
  }

  function openRoomDetail(roomNumber) {
    const room = Storage.getRoom(roomNumber);
    if (!room) return;
    showScreen("room-detail");
    $("room-detail-title").textContent = "חדר " + roomNumber;
    const list = $("room-detail-list");
    const inspections = Object.keys(room.inspections)
      .map(function (k) {
        return room.inspections[k];
      })
      .sort(function (a, b) {
        return a.inspectionNumber - b.inspectionNumber;
      });

    if (!inspections.length) {
      list.innerHTML = '<div class="empty-state">אין בדיקות לחדר זה.</div>';
      return;
    }

    list.innerHTML = inspections
      .map(function (insp) {
        const stats = Storage.getStats(insp);
        const statusLabel = insp.status === "completed" ? "הושלמה" : "בתהליך";
        return (
          '<div class="detail-card">' +
          '<div class="list-card-top">' +
          "<strong>בדיקה " +
          insp.inspectionNumber +
          "</strong>" +
          '<span class="status-pill status-' +
          insp.status +
          '">' +
          statusLabel +
          "</span></div>" +
          '<div class="list-card-meta">' +
          Storage.formatDisplayDate(insp.date) +
          " · ליקויים: " +
          stats.defects +
          " · נבדקו: " +
          stats.checked +
          "</div>" +
          '<div class="btn-row">' +
          '<button type="button" class="btn btn-secondary" data-open-insp="' +
          insp.inspectionNumber +
          '">פתיחה</button>' +
          '<button type="button" class="btn btn-primary" data-edit-insp="' +
          insp.inspectionNumber +
          '">עריכה</button>' +
          '<button type="button" class="btn btn-secondary" data-pdf-insp="' +
          insp.inspectionNumber +
          '">יצירת PDF</button>' +
          '<button type="button" class="btn btn-danger-outline" data-del-insp="' +
          insp.inspectionNumber +
          '">מחיקה</button>' +
          "</div></div>"
        );
      })
      .join("");

    qsa("[data-open-insp]", list).forEach(function (btn) {
      btn.onclick = function () {
        openInspectionSummary(roomNumber, btn.dataset.openInsp);
      };
    });
    qsa("[data-edit-insp]", list).forEach(function (btn) {
      btn.onclick = function () {
        openInspection(roomNumber, btn.dataset.editInsp);
      };
    });
    qsa("[data-pdf-insp]", list).forEach(function (btn) {
      btn.onclick = function () {
        openPdfScreen(roomNumber, btn.dataset.pdfInsp);
      };
    });
    qsa("[data-del-insp]", list).forEach(function (btn) {
      btn.onclick = function () {
        if (
          confirm(
            "האם למחוק את בדיקת חדר " +
              roomNumber +
              " – בדיקה " +
              btn.dataset.delInsp +
              "?"
          )
        ) {
          Storage.deleteInspection(roomNumber, btn.dataset.delInsp);
          if (!Storage.getRoom(roomNumber)) {
            openSavedRooms();
          } else {
            openRoomDetail(roomNumber);
          }
        }
      };
    });

    $("btn-delete-room").onclick = function () {
      if (
        confirm(
          "האם למחוק את כל הבדיקות של חדר " + roomNumber + "?"
        )
      ) {
        Storage.deleteRoom(roomNumber);
        openSavedRooms();
      }
    };
  }

  /* ---------- Search ---------- */
  function openSearch() {
    showScreen("search");
    $("search-input").value = "";
    $("search-results").innerHTML =
      '<div class="empty-state">הזינו מספר חדר להצגה מיידית.</div>';
    $("search-input").focus();
  }

  function runSearch() {
    const q = $("search-input").value.trim();
    const box = $("search-results");
    if (!q) {
      box.innerHTML =
        '<div class="empty-state">הזינו מספר חדר להצגה מיידית.</div>';
      return;
    }
    const room = Storage.searchRoom(q);
    if (!room) {
      box.innerHTML =
        '<div class="empty-state">לא נמצא חדר מספר ' +
        escapeHtml(q) +
        ".</div>";
      return;
    }

    const inspections = Object.keys(room.inspections)
      .map(function (k) {
        return room.inspections[k];
      })
      .sort(function (a, b) {
        return a.inspectionNumber - b.inspectionNumber;
      });

    let html =
      '<div class="search-room-head">חדר ' +
      escapeHtml(room.roomNumber) +
      "</div>";

    inspections.forEach(function (insp) {
      const stats = Storage.getStats(insp);
      html +=
        '<div class="detail-card">' +
        "<strong>בדיקה " +
        insp.inspectionNumber +
        " · " +
        (insp.status === "completed" ? "הושלמה" : "בתהליך") +
        "</strong>" +
        '<div class="list-card-meta">' +
        Storage.formatDisplayDate(insp.date) +
        " · תקינים: " +
        stats.ok +
        " · ליקויים: " +
        stats.defects +
        "</div>";

      if (stats.defectList.length) {
        html += '<ul class="defect-mini-list">';
        stats.defectList.forEach(function (d) {
          html +=
            "<li><strong>" +
            escapeHtml(d.itemName) +
            ":</strong> " +
            escapeHtml(d.note || "—") +
            "</li>";
        });
        html += "</ul>";
      } else {
        html += '<div class="muted">אין ליקויים שמורים בבדיקה זו.</div>';
      }

      html +=
        '<div class="btn-row">' +
        '<button type="button" class="btn btn-secondary" data-s-open="' +
        insp.inspectionNumber +
        '">פתיחה</button>' +
        '<button type="button" class="btn btn-primary" data-s-edit="' +
        insp.inspectionNumber +
        '">עריכה</button>' +
        '<button type="button" class="btn btn-secondary" data-s-pdf="' +
        insp.inspectionNumber +
        '">PDF</button>' +
        "</div></div>";
    });

    box.innerHTML = html;
    qsa("[data-s-open]", box).forEach(function (btn) {
      btn.onclick = function () {
        openInspectionSummary(room.roomNumber, btn.dataset.sOpen);
      };
    });
    qsa("[data-s-edit]", box).forEach(function (btn) {
      btn.onclick = function () {
        openInspection(room.roomNumber, btn.dataset.sEdit);
      };
    });
    qsa("[data-s-pdf]", box).forEach(function (btn) {
      btn.onclick = function () {
        openPdfScreen(room.roomNumber, btn.dataset.sPdf);
      };
    });
  }

  /* ---------- Inspection form ---------- */
  function openInspection(roomNumber, inspectionNumber) {
    if (!loadCurrent(roomNumber, inspectionNumber)) {
      alert("הבדיקה לא נמצאה.");
      renderHome();
      return;
    }
    // Open first incomplete category (or first) so the form is usable immediately
    const next = findNextIncompleteKey(null);
    openCategories = {};
    if (next) openCategories[next.cat.id] = true;
    else if (CHECKLIST[0]) openCategories[CHECKLIST[0].id] = true;

    showScreen("inspection");
    renderInspectionHeader();
    renderChecklist();
  }

  function openInspectionSummary(roomNumber, inspectionNumber) {
    if (!loadCurrent(roomNumber, inspectionNumber)) {
      alert("הבדיקה לא נמצאה.");
      renderHome();
      return;
    }
    // Summary view — skip defect-note blocking so completed/incomplete can be reviewed
    showScreen("summary");
    const stats = Storage.getStats(current.inspection);
    $("sum-room").textContent = current.roomNumber;
    $("sum-date").textContent = Storage.formatDisplayDate(current.inspection.date);
    $("sum-insp").textContent = String(current.inspectionNumber);
    $("sum-checked").textContent = String(stats.checked);
    $("sum-ok").textContent = String(stats.ok);
    $("sum-defects").textContent = String(stats.defects);

    const list = $("sum-defect-list");
    if (!stats.defectList.length) {
      list.innerHTML = '<div class="empty-state">לא נמצאו ליקויים.</div>';
    } else {
      list.innerHTML = stats.defectList
        .map(function (d) {
          return (
            "<li><strong>" +
            escapeHtml(d.itemName) +
            "</strong> <span class=\"muted\">(" +
            escapeHtml(d.categoryName) +
            ")</span><div>" +
            escapeHtml(d.note) +
            "</div></li>"
          );
        })
        .join("");
    }

    const generalNotes = (current.inspection.generalNotes || "").trim();
    const notesBox = $("sum-general-notes");
    if (notesBox) {
      notesBox.textContent = generalNotes || "אין הערות כלליות.";
      notesBox.classList.toggle("is-empty", !generalNotes);
    }
  }

  function updateInspectionProgress() {
    const label = $("insp-progress-label");
    const countEl = $("insp-progress-count");
    const bar = $("insp-progress-bar");
    if (!current.inspection || !countEl || !bar) return;
    let done = 0;
    let total = 0;
    let defects = 0;
    CHECKLIST.forEach(function (cat) {
      cat.items.forEach(function (item) {
        const key = itemKey(cat.id, item.id);
        const row = current.inspection.items[key];
        if (item.optionalExists && row && row.exists === false) return;
        if (item.optionalExists && (!row || row.exists !== true)) {
          total++;
          return;
        }
        total++;
        if (row && row.status) {
          done++;
          if (row.status === "not_ok") defects++;
        }
      });
    });
    const pct = total ? Math.round((done / total) * 100) : 0;
    countEl.textContent = done + "/" + total;
    bar.style.width = pct + "%";
    if (label) {
      label.textContent = defects ? "התקדמות · " + defects + " ליקויים" : "התקדמות";
    }
  }

  function findNextIncompleteKey(afterKey) {
    const keys = [];
    CHECKLIST.forEach(function (cat) {
      cat.items.forEach(function (item) {
        keys.push({ cat: cat, item: item, key: itemKey(cat.id, item.id) });
      });
    });
    let start = 0;
    if (afterKey) {
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].key === afterKey) {
          start = i + 1;
          break;
        }
      }
    }
    const order = keys.slice(start).concat(keys.slice(0, start));
    for (let i = 0; i < order.length; i++) {
      const entry = order[i];
      const row = current.inspection.items[entry.key];
      if (entry.item.optionalExists) {
        if (!row || row.exists == null) return entry;
        if (row.exists === false) continue;
        if (!row.status) return entry;
        continue;
      }
      if (!row || !row.status) return entry;
    }
    return null;
  }

  function jumpToItem(entry) {
    if (!entry) return;
    openCategories[entry.cat.id] = true;
    renderChecklist();
    const el = document.querySelector('[data-item-key="' + entry.key + '"]');
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("is-focus-flash");
      setTimeout(function () {
        el.classList.remove("is-focus-flash");
      }, 900);
    }
  }

  function renderInspectionHeader() {
    const insp = current.inspection;
    $("insp-room-label").textContent = "חדר " + current.roomNumber;
    $("insp-meta-label").textContent =
      "בדיקה " +
      current.inspectionNumber +
      " · " +
      Storage.formatDisplayDate(insp.date);
    $("insp-room-type").value = insp.roomType || "";
    $("insp-extra-id").value = insp.extraId || "";
    const notesEl = $("insp-general-notes");
    if (notesEl) {
      notesEl.value = insp.generalNotes || "";
      autoGrow(notesEl);
    }
    const fast = $("fast-scan-mode");
    if (fast) fast.checked = fastScanEnabled;
    updateInspectionProgress();
  }

  function renderChecklist() {
    const root = $("checklist-root");
    const insp = current.inspection;
    let html = "";

    CHECKLIST.forEach(function (cat) {
      // C3: keep categories collapsed by default for faster mobile paint
      const opened = openCategories[cat.id] === true;

      let done = 0;
      let total = 0;
      let defects = 0;
      cat.items.forEach(function (item) {
        const key = itemKey(cat.id, item.id);
        const row = insp.items[key];
        if (item.optionalExists && row && row.exists === false) return;
        if (item.optionalExists && (!row || row.exists !== true)) {
          total++;
          return;
        }
        total++;
        if (row && row.status) {
          done++;
          if (row.status === "not_ok") defects++;
        }
      });

      html +=
        '<section class="category-card' +
        (opened ? " is-open" : "") +
        '" data-cat="' +
        cat.id +
        '">' +
        '<button type="button" class="category-head" data-toggle-cat="' +
        cat.id +
        '" aria-expanded="' +
        (opened ? "true" : "false") +
        '">' +
        "<div><span class=\"category-name\">" +
        escapeHtml(cat.name) +
        '</span><span class="category-progress">' +
        done +
        "/" +
        total +
        (defects ? " · " + defects + " ליקויים" : "") +
        "</span></div>" +
        '<span class="chevron" aria-hidden="true"></span>' +
        "</button>" +
        '<div class="category-body"' +
        (opened ? "" : " hidden") +
        ">" +
        '<button type="button" class="btn btn-mark-ok" data-mark-cat-ok="' +
        cat.id +
        '">הכל תקין בקטגוריה זו</button>';

      if (opened) {
        cat.items.forEach(function (item) {
          html += renderItemRow(cat, item);
        });
      }

      html += "</div></section>";
    });

    root.innerHTML = html;
    bindChecklistEvents(root);
    updateInspectionProgress();
  }

  function ensureItemRow(key, item) {
    if (!current.inspection.items[key]) {
      current.inspection.items[key] = {
        exists: item.optionalExists ? null : true,
        status: null,
        note: ""
      };
    }
    return current.inspection.items[key];
  }

  /** Mark empty eligible rows as ok — never overwrite existing status. */
  function markEmptyItemsOk(categoryId) {
    let changed = 0;
    CHECKLIST.forEach(function (cat) {
      if (categoryId && cat.id !== categoryId) return;
      cat.items.forEach(function (item) {
        const key = itemKey(cat.id, item.id);
        const row = ensureItemRow(key, item);
        if (item.optionalExists && row.exists !== true) return;
        if (row.status != null) return;
        row.status = "ok";
        changed++;
      });
    });
    return changed;
  }

  function renderItemRow(cat, item) {
    const key = itemKey(cat.id, item.id);
    const row = current.inspection.items[key] || {
      exists: item.optionalExists ? null : true,
      status: null,
      note: ""
    };

    let body = "";
    if (item.optionalExists) {
      body +=
        '<div class="exists-block">' +
        '<div class="exists-label">האם הפריט קיים בחדר?</div>' +
        '<div class="btn-pair">' +
        '<button type="button" class="btn-choice' +
        (row.exists === true ? " is-active is-ok" : "") +
        '" data-exists="true" data-key="' +
        key +
        '">קיים</button>' +
        '<button type="button" class="btn-choice' +
        (row.exists === false ? " is-active is-missing" : "") +
        '" data-exists="false" data-key="' +
        key +
        '">לא קיים</button>' +
        "</div></div>";
    }

    const showStatus =
      !item.optionalExists || row.exists === true;

    if (showStatus) {
      const isDefect = row.status === "not_ok";
      const noteRequired = isDefect && !(row.note && row.note.trim());
      body +=
        '<div class="status-block">' +
        '<div class="btn-pair">' +
        '<button type="button" class="btn-choice' +
        (row.status === "ok" ? " is-active is-ok" : "") +
        '" data-status="ok" data-key="' +
        key +
        '">תקין</button>' +
        '<button type="button" class="btn-choice' +
        (row.status === "not_ok" ? " is-active is-bad" : "") +
        '" data-status="not_ok" data-key="' +
        key +
        '">לא תקין</button>' +
        "</div>" +
        '<label class="note-label" for="note-' +
        key +
        '">' +
        (isDefect ? "הסבר הליקוי (חובה)" : "הערה (אופציונלי)") +
        "</label>" +
        '<textarea id="note-' +
        key +
        '" class="note-field' +
        (noteRequired ? " is-required" : "") +
        '" data-note="' +
        key +
        '" rows="2" placeholder="' +
        (isDefect ? "תארו את הליקוי…" : "הערה במידת הצורך…") +
        '">' +
        escapeHtml(row.note || "") +
        "</textarea>" +
        "</div>";
    } else if (item.optionalExists && row.exists === false) {
      body += '<div class="missing-hint">לא קיים בחדר — אין צורך בסימון תקין/לא תקין</div>';
    }

    return (
      '<article class="item-row' +
      (row.status === "not_ok" ? " is-defect" : "") +
      (row.exists === false ? " is-absent" : "") +
      '" data-item-key="' +
      key +
      '">' +
      '<h3 class="item-name">' +
      escapeHtml(item.name) +
      "</h3>" +
      body +
      "</article>"
    );
  }

  function bindChecklistEvents(root) {
    qsa("[data-toggle-cat]", root).forEach(function (btn) {
      btn.onclick = function () {
        const id = btn.dataset.toggleCat;
        openCategories[id] = !openCategories[id];
        renderChecklist();
      };
    });

    qsa("[data-mark-cat-ok]", root).forEach(function (btn) {
      btn.onclick = function (e) {
        e.stopPropagation();
        const catId = btn.dataset.markCatOk;
        scheduleSave(function () {
          markEmptyItemsOk(catId);
        });
        renderChecklist();
        if (fastScanEnabled) {
          const next = findNextIncompleteKey(null);
          if (next) jumpToItem(next);
        }
      };
    });

    qsa("[data-exists]", root).forEach(function (btn) {
      btn.onclick = function () {
        const key = btn.dataset.key;
        const exists = btn.dataset.exists === "true";
        scheduleSave(function () {
          const row = current.inspection.items[key];
          row.exists = exists;
          if (!exists) {
            row.status = null;
            row.note = "";
          }
        });
        renderChecklist();
        if (fastScanEnabled && exists === false) {
          const next = findNextIncompleteKey(key);
          if (next) jumpToItem(next);
        }
      };
    });

    qsa("[data-status]", root).forEach(function (btn) {
      btn.onclick = function () {
        const key = btn.dataset.key;
        const status = btn.dataset.status;
        const row = current.inspection.items[key];
        const nextStatus = row.status === status ? null : status;
        scheduleSave(function () {
          current.inspection.items[key].status = nextStatus;
        });
        renderChecklist();
        if (nextStatus === "not_ok") {
          const ta = document.getElementById("note-" + key);
          if (ta) ta.focus();
          return;
        }
        if (fastScanEnabled && nextStatus === "ok") {
          const next = findNextIncompleteKey(key);
          if (next) jumpToItem(next);
        }
      };
    });

    qsa("[data-note]", root).forEach(function (ta) {
      ta.addEventListener("input", function () {
        const key = ta.dataset.note;
        autoGrow(ta);
        scheduleSave(function () {
          current.inspection.items[key].note = ta.value;
        });
        ta.classList.toggle(
          "is-required",
          current.inspection.items[key].status === "not_ok" && !ta.value.trim()
        );
      });
      ta.addEventListener("blur", function () {
        const key = ta.dataset.note;
        const row = current.inspection.items[key];
        if (
          fastScanEnabled &&
          row &&
          row.status === "not_ok" &&
          row.note &&
          row.note.trim()
        ) {
          const next = findNextIncompleteKey(key);
          if (next) jumpToItem(next);
        }
      });
      autoGrow(ta);
    });
  }

  function autoGrow(el) {
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 48) + "px";
  }

  /* ---------- Summary ---------- */
  function openSummary() {
    const missing = Storage.getMissingDefectNotes(current.inspection);
    if (missing.length) {
      alert(
        "לא ניתן לסיים — יש " +
          missing.length +
          " ליקויים ללא הסבר.\nהראשון: " +
          missing[0].itemName +
          " (" +
          missing[0].categoryName +
          ")"
      );
      // Open category of first missing
      const meta = findItemMeta(missing[0].key);
      if (meta) {
        openCategories[meta.category.id] = true;
        renderChecklist();
        const el = document.querySelector(
          '[data-item-key="' + missing[0].key + '"]'
        );
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    persistCurrent();
    showScreen("summary");
    const stats = Storage.getStats(current.inspection);
    $("sum-room").textContent = current.roomNumber;
    $("sum-date").textContent = Storage.formatDisplayDate(current.inspection.date);
    $("sum-insp").textContent = String(current.inspectionNumber);
    $("sum-checked").textContent = String(stats.checked);
    $("sum-ok").textContent = String(stats.ok);
    $("sum-defects").textContent = String(stats.defects);

    const list = $("sum-defect-list");
    if (!stats.defectList.length) {
      list.innerHTML = '<div class="empty-state">לא נמצאו ליקויים.</div>';
    } else {
      list.innerHTML = stats.defectList
        .map(function (d) {
          return (
            "<li><strong>" +
            escapeHtml(d.itemName) +
            "</strong> <span class=\"muted\">(" +
            escapeHtml(d.categoryName) +
            ")</span><div>" +
            escapeHtml(d.note) +
            "</div></li>"
          );
        })
        .join("");
    }

    const generalNotes = (current.inspection.generalNotes || "").trim();
    const notesBox = $("sum-general-notes");
    if (notesBox) {
      notesBox.textContent = generalNotes || "אין הערות כלליות.";
      notesBox.classList.toggle("is-empty", !generalNotes);
    }
  }

  function finishAndSave() {
    const missing = Storage.getMissingDefectNotes(current.inspection);
    if (missing.length) {
      alert("יש ליקויים ללא הסבר. יש להשלים לפני סיום.");
      return;
    }
    const roomNumber = current.roomNumber;
    const inspectionNumber = current.inspectionNumber;
    current.inspection.status = "completed";
    Storage.completeInspection(roomNumber, inspectionNumber);

    doneContext = {
      roomNumber: roomNumber,
      inspectionNumber: inspectionNumber
    };

    const sub = $("done-sub");
    if (sub) {
      sub.textContent =
        "חדר " + roomNumber + " · בדיקה " + inspectionNumber + " — מה תרצו עכשיו?";
    }
    showScreen("done");
  }

  let doneContext = null;

  /* ---------- PDF screen ---------- */
  let pdfContext = null;

  function openPdfPicker() {
    showScreen("pdf-picker");
    const list = $("pdf-picker-list");
    const rooms = Storage.listRooms();
    if (!rooms.length) {
      list.innerHTML = '<div class="empty-state">אין בדיקות שמורות ליצירת PDF.</div>';
      return;
    }
    let html = "";
    rooms.forEach(function (room) {
      room.inspections.forEach(function (insp) {
        html +=
          '<button type="button" class="list-card" data-pdf-room="' +
          escapeHtml(room.roomNumber) +
          '" data-pdf-n="' +
          insp.inspectionNumber +
          '">' +
          '<div class="list-card-title">חדר ' +
          escapeHtml(room.roomNumber) +
          " · בדיקה " +
          insp.inspectionNumber +
          "</div>" +
          '<div class="list-card-meta">' +
          Storage.formatDisplayDate(insp.date) +
          " · " +
          (insp.status === "completed" ? "הושלמה" : "בתהליך") +
          "</div></button>";
      });
    });
    list.innerHTML = html;
    qsa("[data-pdf-room]", list).forEach(function (btn) {
      btn.onclick = function () {
        openPdfScreen(btn.dataset.pdfRoom, btn.dataset.pdfN);
      };
    });
  }

  function openPdfScreen(roomNumber, inspectionNumber) {
    const insp = Storage.getInspection(roomNumber, inspectionNumber);
    if (!insp) {
      alert("הבדיקה לא נמצאה.");
      return;
    }
    pdfContext = {
      roomNumber: String(roomNumber),
      inspectionNumber: Number(inspectionNumber),
      inspection: insp
    };
    showScreen("pdf");
    $("pdf-status").textContent = "";
    PdfService.renderPreview($("pdf-preview"), pdfContext.roomNumber, pdfContext.inspection);
    $("pdf-filename").textContent = PdfService.pdfFileName(
      pdfContext.roomNumber,
      pdfContext.inspectionNumber,
      Storage.todayISO()
    );
  }

  async function withPdfBusy(fn) {
    const status = $("pdf-status");
    status.textContent = "מעבד…";
    qsa("#screen-pdf .btn").forEach(function (b) {
      b.disabled = true;
    });
    try {
      await fn();
      status.textContent = "מוכן";
    } catch (e) {
      console.error(e);
      status.textContent = e.message || "שגיאה ביצירת PDF";
      alert(status.textContent);
    } finally {
      qsa("#screen-pdf .btn").forEach(function (b) {
        b.disabled = false;
      });
    }
  }

  /* ---------- Weekly agenda ---------- */
  let weeklyWeekOffset = 0; // 0 = current week (Sun–Sat)
  let weeklyFilter = "room-asc";
  let weeklyExpanded = {};

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  /** Week starts Sunday (א׳) ends Saturday (ש׳). */
  function getWeekBounds(offsetWeeks) {
    const now = new Date();
    const day = now.getDay(); // 0 Sun
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    start.setDate(start.getDate() + offsetWeeks * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      start: start,
      end: end,
      startISO: toISODate(start),
      endISO: toISODate(end)
    };
  }

  function formatShortDate(iso) {
    if (!iso) return "—";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return parts[2] + "/" + parts[1];
  }

  function compareRoomNumbers(a, b) {
    const na = Number(a);
    const nb = Number(b);
    const aNum = !isNaN(na) && String(na) === String(a).trim();
    const bNum = !isNaN(nb) && String(nb) === String(b).trim();
    if (aNum && bNum) return na - nb;
    return String(a).localeCompare(String(b), "he", { numeric: true });
  }

  function collectWeeklyRows(weekOffset) {
    const bounds = getWeekBounds(weekOffset);
    const store = Storage.getAll();
    const rows = [];
    Object.keys(store.rooms || {}).forEach(function (rk) {
      const room = store.rooms[rk];
      Object.keys(room.inspections || {}).forEach(function (ik) {
        const insp = room.inspections[ik];
        if (!insp) return;
        const date = insp.date || "";
        if (date < bounds.startISO || date > bounds.endISO) return;
        const stats = Storage.getStats(insp);
        rows.push({
          roomNumber: room.roomNumber,
          inspection: insp,
          stats: stats,
          blocking: !!stats.blocking,
          key: room.roomNumber + "::" + insp.inspectionNumber
        });
      });
    });
    return { bounds: bounds, rows: rows };
  }

  function applyWeeklyFilter(rows, filter, searchQ) {
    let list = rows.slice();
    const q = String(searchQ || "").trim();
    if (q) {
      list = list.filter(function (r) {
        return String(r.roomNumber).indexOf(q) !== -1;
      });
    }

    if (filter === "completed") {
      list = list.filter(function (r) {
        return r.inspection.status === "completed";
      });
    } else if (filter === "in_progress") {
      list = list.filter(function (r) {
        return r.inspection.status === "in_progress";
      });
    } else if (filter === "defects") {
      list = list.filter(function (r) {
        return r.stats.defects > 0;
      });
    } else if (filter === "blocking") {
      list = list.filter(function (r) {
        return r.blocking;
      });
    }

    if (filter === "date-desc") {
      list.sort(function (a, b) {
        const d = String(b.inspection.date || "").localeCompare(String(a.inspection.date || ""));
        if (d) return d;
        return compareRoomNumbers(a.roomNumber, b.roomNumber);
      });
    } else if (filter === "date-asc") {
      list.sort(function (a, b) {
        const d = String(a.inspection.date || "").localeCompare(String(b.inspection.date || ""));
        if (d) return d;
        return compareRoomNumbers(a.roomNumber, b.roomNumber);
      });
    } else {
      // room-asc / all / status filters default to room ascending
      list.sort(function (a, b) {
        const c = compareRoomNumbers(a.roomNumber, b.roomNumber);
        if (c) return c;
        return a.inspection.inspectionNumber - b.inspection.inspectionNumber;
      });
    }
    return list;
  }

  function openWeekly() {
    showScreen("weekly");
    renderWeekly();
  }

  function renderWeekly() {
    const pack = collectWeeklyRows(weeklyWeekOffset);
    const bounds = pack.bounds;
    const searchEl = $("weekly-search");
    const searchQ = searchEl ? searchEl.value : "";
    const list = applyWeeklyFilter(pack.rows, weeklyFilter, searchQ);

    const title = $("weekly-week-title");
    const range = $("weekly-week-range");
    if (title) {
      title.textContent =
        weeklyWeekOffset === 0
          ? "השבוע הנוכחי"
          : weeklyWeekOffset < 0
            ? "לפני " + Math.abs(weeklyWeekOffset) + " שבועות"
            : "בעוד " + weeklyWeekOffset + " שבועות";
    }
    if (range) {
      range.textContent =
        formatShortDate(bounds.startISO) +
        " – " +
        formatShortDate(bounds.endISO) +
        " (א׳–ש׳)";
    }

    qsa("[data-weekly-filter]").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.weeklyFilter === weeklyFilter);
    });

    // Stats from full week (before search), but respect status-ish filters for meeting focus
    const forStats =
      weeklyFilter === "all" ||
      weeklyFilter === "room-asc" ||
      weeklyFilter === "date-asc" ||
      weeklyFilter === "date-desc"
        ? pack.rows
        : applyWeeklyFilter(pack.rows, weeklyFilter, "");

    const roomSet = {};
    let completed = 0;
    let inProgress = 0;
    let withDefects = 0;
    let defectTotal = 0;
    let blockingRooms = {};
    forStats.forEach(function (r) {
      roomSet[r.roomNumber] = true;
      if (r.inspection.status === "completed") completed++;
      if (r.inspection.status === "in_progress") inProgress++;
      if (r.stats.defects > 0) {
        withDefects++;
        defectTotal += r.stats.defects;
      }
      if (r.blocking) {
        blockingRooms[r.roomNumber] = true;
      }
    });

    const statsEl = $("weekly-stats");
    if (statsEl) {
      statsEl.innerHTML =
        '<div class="weekly-stat"><span class="muted">חדרים</span><strong>' +
        Object.keys(roomSet).length +
        "</strong></div>" +
        '<div class="weekly-stat"><span class="muted">בדיקות</span><strong>' +
        forStats.length +
        "</strong></div>" +
        '<div class="weekly-stat"><span class="muted">הושלמו</span><strong>' +
        completed +
        "</strong></div>" +
        '<div class="weekly-stat"><span class="muted">בתהליך</span><strong>' +
        inProgress +
        "</strong></div>" +
        '<div class="weekly-stat weekly-stat-warn"><span class="muted">עם ליקויים</span><strong>' +
        withDefects +
        "</strong></div>" +
        '<div class="weekly-stat weekly-stat-warn"><span class="muted">סה״כ ליקויים</span><strong>' +
        defectTotal +
        "</strong></div>" +
        '<div class="weekly-stat weekly-stat-bad"><span class="muted">מונע איכלוס</span><strong>' +
        Object.keys(blockingRooms).length +
        " חדרים</strong></div>";
    }

    const box = $("weekly-list");
    if (!box) return;
    if (!list.length) {
      box.innerHTML =
        '<div class="empty-state">אין בדיקות בשבוע זה לפי הסינון הנוכחי.</div>';
      return;
    }

    box.innerHTML = list
      .map(function (r) {
        const statusLabel =
          r.inspection.status === "completed" ? "הושלמה" : "בתהליך";
        const open = !!weeklyExpanded[r.key];
        const defectsHtml =
          r.stats.defectList && r.stats.defectList.length
            ? '<ul class="weekly-defect-list">' +
              r.stats.defectList
                .map(function (d) {
                  return (
                    "<li" +
                    (d.blocking ? ' class="is-blocking-defect"' : "") +
                    "><strong>" +
                    escapeHtml(d.itemName) +
                    "</strong> <span class=\"muted\">(" +
                    escapeHtml(d.categoryName) +
                    ")</span>" +
                    (d.blocking
                      ? ' <span class="status-pill status-blocking">מונע איכלוס</span>'
                      : "") +
                    (d.note
                      ? "<div class=\"weekly-defect-note\">" +
                        escapeHtml(d.note) +
                        "</div>"
                      : "") +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
            : '<p class="muted">אין ליקויים.</p>';

        return (
          '<article class="weekly-card' +
          (r.blocking ? " is-blocking" : "") +
          '">' +
          '<div class="weekly-card-top">' +
          "<div>" +
          '<div class="weekly-card-title">חדר ' +
          escapeHtml(r.roomNumber) +
          "</div>" +
          '<div class="list-card-meta">' +
          Storage.formatDisplayDate(r.inspection.date) +
          " · בדיקה " +
          r.inspection.inspectionNumber +
          "</div></div>" +
          '<div class="weekly-card-badges">' +
          '<span class="status-pill status-' +
          r.inspection.status +
          '">' +
          statusLabel +
          "</span>" +
          (r.blocking
            ? '<span class="status-pill status-blocking">מונע איכלוס (' +
              r.stats.blockingCount +
              ")</span>"
            : "") +
          '<span class="status-pill">' +
          r.stats.defects +
          " ליקויים</span>" +
          "</div></div>" +
          '<div class="btn-row weekly-card-actions">' +
          '<button type="button" class="btn btn-secondary" data-weekly-open="' +
          escapeHtml(r.roomNumber) +
          '" data-weekly-insp="' +
          r.inspection.inspectionNumber +
          '">פתיחה</button>' +
          '<button type="button" class="btn btn-secondary" data-weekly-pdf-room="' +
          escapeHtml(r.roomNumber) +
          '" data-weekly-insp="' +
          r.inspection.inspectionNumber +
          '">PDF</button>' +
          '<button type="button" class="btn btn-secondary" data-weekly-toggle="' +
          escapeHtml(r.key) +
          '">' +
          (open ? "הסתר ליקויים" : "פירוט ליקויים") +
          "</button>" +
          "</div>" +
          (open
            ? '<div class="weekly-card-details">' +
              (r.blocking
                ? '<p class="weekly-blocking-note">ליקויים קריטיים (חשמל / שבור / נעילה / DND / נזילה / גבס קיר) מונעים איכלוס עד לטיפול.</p>'
                : "") +
              defectsHtml +
              "</div>"
            : "") +
          "</article>"
        );
      })
      .join("");

    qsa("[data-weekly-open]", box).forEach(function (btn) {
      btn.onclick = function () {
        openInspectionSummary(btn.dataset.weeklyOpen, btn.dataset.weeklyInsp);
      };
    });
    qsa("[data-weekly-pdf-room]", box).forEach(function (btn) {
      btn.onclick = function () {
        openPdfScreen(btn.dataset.weeklyPdfRoom, btn.dataset.weeklyInsp);
      };
    });
    qsa("[data-weekly-toggle]", box).forEach(function (btn) {
      btn.onclick = function () {
        const key = btn.dataset.weeklyToggle;
        weeklyExpanded[key] = !weeklyExpanded[key];
        renderWeekly();
      };
    });
  }

  function exportWeeklyPdf() {
    const pack = collectWeeklyRows(weeklyWeekOffset);
    const searchEl = $("weekly-search");
    const rows = applyWeeklyFilter(
      pack.rows,
      weeklyFilter,
      searchEl ? searchEl.value : ""
    );

    if (!rows.length) {
      alert("אין נתונים לייצוא לפי הסינון הנוכחי.");
      return;
    }

    setSaveIndicator("saving", "יוצר סיכום שבועי…");
    PdfService.downloadWeeklySummary({
      bounds: pack.bounds,
      rows: rows,
      filter: weeklyFilter
    })
      .then(function () {
        setSaveIndicator("saved", "הסיכום נשמר");
      })
      .catch(function (err) {
        console.error(err);
        setSaveIndicator("idle");
        alert((err && err.message) || "יצירת הסיכום נכשלה");
      });
  }

  function openAbout() {
    const copyEl = $("about-copyright");
    if (copyEl && APP_META && APP_META.copyright) {
      copyEl.textContent = APP_META.copyright;
    }
    showScreen("about");
  }

  /* ---------- Wire up ---------- */
  function bindGlobal() {
    $("btn-home-logo").onclick = function () {
      persistCurrent();
      renderHome();
    };

    $("nav-new").onclick = openNewInspectionForm;
    $("nav-continue").onclick = openContinueList;
    $("nav-saved").onclick = openSavedRooms;
    $("nav-search").onclick = openSearch;
    $("nav-pdf").onclick = openPdfPicker;
    $("nav-weekly").onclick = openWeekly;
    $("nav-full-pdf-backup").onclick = function () {
      const store = Storage.getAll();
      const roomCount = Object.keys(store.rooms || {}).length;
      if (!roomCount) {
        alert("אין חדרים שמורים ליצירת גיבוי.");
        return;
      }
      if (
        !confirm(
          "הגיבוי יכלול את כל החדרים וכל הבדיקות בחשבון שלך, כולל בדיקות בתהליך. האם להמשיך?"
        )
      ) {
        return;
      }
      setSaveIndicator("saving", "יוצר גיבוי PDF…");
      PdfService.downloadFullBackup()
        .then(function (result) {
          setSaveIndicator("saved", "נשמר באתר");
          alert(
            "הגיבוי המלא נוצר בהצלחה. נכללו בו " +
              result.rooms +
              " חדרים ו־" +
              result.inspections +
              " בדיקות."
          );
        })
        .catch(function (err) {
          console.error(err);
          setSaveIndicator("idle");
          alert(
            (err && err.message) ||
              "יצירת הגיבוי נכשלה. הנתונים המקומיים לא השתנו."
          );
        });
    };
    $("nav-about").onclick = openAbout;

    if ($("btn-week-prev")) {
      $("btn-week-prev").onclick = function () {
        weeklyWeekOffset -= 1;
        renderWeekly();
      };
    }
    if ($("btn-week-next")) {
      $("btn-week-next").onclick = function () {
        weeklyWeekOffset += 1;
        renderWeekly();
      };
    }
    if ($("btn-week-today")) {
      $("btn-week-today").onclick = function () {
        weeklyWeekOffset = 0;
        renderWeekly();
      };
    }
    qsa("[data-weekly-filter]").forEach(function (btn) {
      btn.onclick = function () {
        weeklyFilter = btn.dataset.weeklyFilter;
        renderWeekly();
      };
    });
    if ($("weekly-search")) {
      $("weekly-search").addEventListener("input", function () {
        renderWeekly();
      });
    }
    if ($("btn-weekly-pdf")) {
      $("btn-weekly-pdf").onclick = exportWeeklyPdf;
    }

    $("form-auth").onsubmit = function (e) {
      if (e && e.preventDefault) e.preventDefault();
      submitAuth();
      return false;
    };
    $("btn-logout").onclick = function () {
      logoutUser();
    };

    qsa("[data-back]").forEach(function (btn) {
      btn.onclick = function () {
        persistCurrent();
        const target = btn.dataset.back;
        if (target === "home") renderHome();
        else if (target === "saved") openSavedRooms();
        else if (target === "inspection") {
          showScreen("inspection");
          renderChecklist();
        } else showScreen(target);
      };
    });

    $("new-is-retest").addEventListener("change", updateRetestLabel);
    $("btn-start-inspection").onclick = startNewInspection;

    $("insp-room-type").addEventListener("input", function () {
      scheduleSave(function () {
        current.inspection.roomType = $("insp-room-type").value;
      });
    });
    $("insp-extra-id").addEventListener("input", function () {
      scheduleSave(function () {
        current.inspection.extraId = $("insp-extra-id").value;
      });
    });
    $("insp-general-notes").addEventListener("input", function () {
      const el = $("insp-general-notes");
      autoGrow(el);
      scheduleSave(function () {
        current.inspection.generalNotes = el.value;
      });
    });

    $("btn-room-all-ok").onclick = function () {
      scheduleSave(function () {
        markEmptyItemsOk(null);
      });
      renderChecklist();
    };
    $("btn-to-summary").onclick = openSummary;
    const fastScan = $("fast-scan-mode");
    if (fastScan) {
      fastScan.onchange = function () {
        fastScanEnabled = !!fastScan.checked;
      };
    }
    $("btn-summary-edit").onclick = function () {
      showScreen("inspection");
      renderChecklist();
    };
    $("btn-summary-finish").onclick = finishAndSave;
    $("btn-summary-pdf").onclick = function () {
      persistCurrent();
      openPdfScreen(current.roomNumber, current.inspectionNumber);
    };

    $("btn-done-pdf").onclick = function () {
      if (!doneContext) {
        renderHome();
        return;
      }
      openPdfScreen(doneContext.roomNumber, doneContext.inspectionNumber);
    };
    $("btn-done-new").onclick = function () {
      doneContext = null;
      openNewInspectionForm();
    };
    $("btn-done-home").onclick = function () {
      doneContext = null;
      renderHome();
    };

    $("search-input").addEventListener("input", runSearch);

    $("btn-pdf-download").onclick = function () {
      if (!pdfContext) return;
      withPdfBusy(function () {
        return PdfService.download(pdfContext.roomNumber, pdfContext.inspection);
      });
    };
    $("btn-pdf-print").onclick = function () {
      if (!pdfContext) return;
      withPdfBusy(function () {
        return PdfService.print(pdfContext.roomNumber, pdfContext.inspection);
      });
    };
    $("btn-pdf-share").onclick = function () {
      if (!pdfContext) return;
      withPdfBusy(function () {
        return PdfService.share(pdfContext.roomNumber, pdfContext.inspection);
      });
    };

    // Persist on hide / unload
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") persistCurrent();
    });
    window.addEventListener("pagehide", persistCurrent);
    window.addEventListener("beforeunload", persistCurrent);
  }

  function updateAccountBar(user) {
    const bar = $("account-bar");
    const nameEl = $("account-name");
    if (!bar || !nameEl) return;
    if (user && user.id) {
      nameEl.textContent = Auth.getDisplayName(user) || user.email || "";
      bar.classList.remove("is-hidden");
    } else {
      nameEl.textContent = "";
      bar.classList.add("is-hidden");
    }
  }

  function showAuthScreen(message) {
    updateAccountBar(null);
    showScreen("auth");
    const hint = $("auth-hint");
    const err = $("auth-error");
    if (err) err.textContent = "";
    if (hint) hint.textContent = message || "";
  }

  async function submitAuth() {
    const err = $("auth-error");
    const hint = $("auth-hint");
    if (err) err.textContent = "";
    if (hint) hint.textContent = "";
    const loginId = $("auth-username").value.trim();
    const password = $("auth-password").value;
    if (!loginId || !password) {
      if (err) err.textContent = "נא למלא שם משתמש וסיסמה.";
      return;
    }
    try {
      setSaveIndicator("saving", "מתחבר…");
      await Auth.signIn(loginId, password);
      $("auth-password").value = "";
      await enterAppSession();
    } catch (e) {
      console.error(e);
      if (err) err.textContent = (e && e.message) || "ההתחברות נכשלה";
      setSaveIndicator("idle");
    }
  }

  function adoptLegacyLocalDataIfNeeded() {
    const currentStore = Storage.getAll();
    if (Object.keys((currentStore && currentStore.rooms) || {}).length) return;
    const legacy = Storage.getLegacyStore();
    if (!Object.keys((legacy && legacy.rooms) || {}).length) return;
    Storage.replaceStore(legacy);
  }

  /** If cloud user cache is empty, copy from previous local-only cache. */
  async function adoptLocalCacheToCloudUser(cloudUserId) {
    if (!cloudUserId || cloudUserId === Auth.LOCAL_USER_ID) return;
    await Storage.activateUser(cloudUserId);
    const cloudStore = Storage.getAll();
    if (Object.keys((cloudStore && cloudStore.rooms) || {}).length) return;

    await Storage.activateUser(Auth.LOCAL_USER_ID);
    const localStore = Storage.getAll();
    await Storage.activateUser(cloudUserId);
    if (!Object.keys((localStore && localStore.rooms) || {}).length) return;
    Storage.replaceStore(localStore);
  }

  async function logoutUser(message) {
    try {
      persistCurrent();
      Auth.stopIdleWatch();
      await Auth.signOut();
    } catch (e) {
      console.error(e);
    }
    Storage.setActiveUser(null);
    current.roomNumber = null;
    current.inspectionNumber = null;
    current.inspection = null;
    showAuthScreen(message || "התנתקתם בהצלחה.");
    setSaveIndicator("idle");
  }

  function handleIdleTimeout() {
    persistCurrent();
    Storage.setActiveUser(null);
    current.roomNumber = null;
    current.inspectionNumber = null;
    current.inspection = null;
    showAuthScreen("התנתקתם אוטומטית אחרי 90 דקות ללא שימוש.");
    setSaveIndicator("idle");
  }

  async function enterAppSession() {
    const user = Auth.getUser();
    if (!user) {
      showAuthScreen();
      return;
    }

    if (Auth.isCloudConnected && Auth.isCloudConnected()) {
      await adoptLocalCacheToCloudUser(user.id);
    } else {
      await Storage.activateUser(user.id);
      adoptLegacyLocalDataIfNeeded();
    }

    updateAccountBar(user);
    Auth.startIdleWatch();

    SyncEngine.init();
    SyncEngine.onStatus(applySyncStatus);

    if (Auth.isCloudConnected && Auth.isCloudConnected()) {
      window.onSyncConflict = function (info) {
        alert(
          "נמצאה התנגשות בחדר " +
            info.roomNumber +
            " – בדיקה " +
            info.inspectionNumber +
            ".\n" +
            "הגרסה המקומית נשמרה. הגרסה מהשרת נשמרה כעותק בטוח בשם: " +
            info.copyRoom +
            ".\nשום הערה לא נמחקה."
        );
      };

      try {
        setSaveIndicator("saving", "מסנכרן…");
        const pull = await SyncEngine.pullAll();
        if (pull && pull.conflicts && pull.conflicts.length) {
          pull.conflicts.forEach(function (info) {
            if (typeof window.onSyncConflict === "function") {
              window.onSyncConflict(info);
            }
          });
        }
        SyncEngine.scheduleSync();
      } catch (e) {
        console.error(e);
        setSaveIndicator("pending", "עובדים מקומית — הסנכרון יידחה");
      }
    }

    setSaveIndicator("idle");
    await playEntranceAnimation();
    renderHome();
  }

  function playEntranceAnimation() {
    return new Promise(function (resolve) {
      const gate = $("app-entrance");
      const hello = $("entrance-hello");
      if (!gate) {
        resolve();
        return;
      }

      const reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const name = Auth.getDisplayName(Auth.getUser()) || "MP2001";
      if (hello) hello.textContent = "שלום, " + name;

      if (reduce) {
        resolve();
        return;
      }

      document.body.classList.add("is-entering");
      gate.classList.remove("is-hidden", "is-out");
      gate.classList.add("is-play");
      gate.setAttribute("aria-hidden", "false");

      // Force reflow so animation restarts cleanly on every login
      void gate.offsetWidth;
      gate.classList.add("is-in");

      window.setTimeout(function () {
        gate.classList.add("is-out");
        window.setTimeout(function () {
          gate.classList.add("is-hidden");
          gate.classList.remove("is-play", "is-in", "is-out");
          gate.setAttribute("aria-hidden", "true");
          document.body.classList.remove("is-entering");
          resolve();
        }, 620);
      }, 1550);
    });
  }

  async function init() {
    $("app-title").textContent = APP_META.name;
    $("footer-copy").textContent = APP_META.copyright;
    bindGlobal();
    Auth.onIdleTimeout(handleIdleTimeout);

    try {
      await Storage.initDb();
      await Auth.init();
      if (Auth.isLoggedIn()) {
        await enterAppSession();
      } else if (Auth.expiredOnInit) {
        showAuthScreen("התנתקתם אוטומטית אחרי 90 דקות ללא שימוש.");
      } else {
        showAuthScreen();
      }
    } catch (e) {
      console.error(e);
      showAuthScreen("לא ניתן להתחבר כרגע. הנתונים במכשיר לא נמחקו.");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
