/**
 * © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001
 * PDF generation, preview, download, print and share.
 * Uses html2pdf.js so Hebrew RTL layout renders correctly.
 */
(function (global) {
  const COPYRIGHT = () => (global.APP_META && global.APP_META.copyright) || "";

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function markCell(active) {
    return active ? "✓" : "";
  }

  function buildRowsHtml(inspection) {
    let html = "";
    for (const cat of global.CHECKLIST) {
      html +=
        '<tr class="pdf-cat"><td colspan="4">' +
        escapeHtml(cat.name) +
        "</td></tr>";

      for (const item of cat.items) {
        const key = global.itemKey(cat.id, item.id);
        const row = (inspection.items && inspection.items[key]) || {
          exists: item.optionalExists ? null : true,
          status: null,
          note: ""
        };

        let note = row.note || "";
        let ok = false;
        let notOk = false;

        if (item.optionalExists && row.exists === false) {
          note = row.note && String(row.note).trim() ? row.note : "לא קיים בחדר";
        } else {
          ok = row.status === "ok";
          notOk = row.status === "not_ok";
        }

        html +=
          '<tr class="pdf-row">' +
          "<td>" +
          escapeHtml(item.name) +
          "</td>" +
          '<td class="pdf-center">' +
          markCell(ok) +
          "</td>" +
          '<td class="pdf-center">' +
          markCell(notOk) +
          "</td>" +
          '<td class="pdf-note">' +
          escapeHtml(note).replace(/\n/g, "<br>") +
          "</td>" +
          "</tr>";
      }
    }
    return html;
  }

  function pdfFileName(roomNumber, inspectionNumber, dateIso) {
    const datePart = global.Storage.formatFileDate(dateIso || global.Storage.todayISO());
    return (
      "בדיקת-חדר-" +
      roomNumber +
      "-בדיקה-" +
      inspectionNumber +
      "-" +
      datePart +
      ".pdf"
    );
  }

  function buildDocumentHtml(roomNumber, inspection, options) {
    const opts = options || {};
    const createdDate = global.Storage.todayISO();
    const displayCreated = global.Storage.formatDisplayDate(createdDate);
    const roomType = inspection.roomType || "";
    const formName = global.APP_META.formName;
    const stats = global.Storage.getStats(inspection);

    const metaLines = [
      "מספר חדר: " + roomNumber,
      "תאריך יצירת PDF: " + displayCreated,
      "מספר בדיקה: " + inspection.inspectionNumber
    ];
    if (roomType) metaLines.push("סוג חדר: " + roomType);
    if (inspection.extraId) metaLines.push("מזהה נוסף: " + inspection.extraId);

    return (
      '<div class="pdf-root" dir="rtl">' +
      '<div class="pdf-header">' +
      '<div class="pdf-brand">' +
      '<img class="pdf-logo" src="static/IMG/LOGO.png" alt="">' +
      "<div>" +
      '<div class="pdf-title">' +
      escapeHtml(formName) +
      "</div>" +
      '<div class="pdf-subtitle">' +
      escapeHtml(global.APP_META.name) +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="pdf-meta">' +
      metaLines
        .map(function (line) {
          return "<div>" + escapeHtml(line) + "</div>";
        })
        .join("") +
      "</div>" +
      "</div>" +
      (opts.includeSummary
        ? '<div class="pdf-summary">' +
          "<div>פריטים שנבדקו: " +
          stats.checked +
          "</div>" +
          "<div>תקינים: " +
          stats.ok +
          "</div>" +
          "<div>ליקויים: " +
          stats.defects +
          "</div>" +
          "</div>"
        : "") +
      '<table class="pdf-table">' +
      "<thead>" +
      "<tr>" +
      "<th>נושא לבדיקה</th>" +
      "<th>תקין</th>" +
      "<th>לא תקין</th>" +
      "<th>הערות</th>" +
      "</tr>" +
      "</thead>" +
      "<tbody>" +
      buildRowsHtml(inspection) +
      "</tbody>" +
      "</table>" +
      (inspection.generalNotes && String(inspection.generalNotes).trim()
        ? '<div class="pdf-general-notes">' +
          "<h3>הערות כלליות</h3>" +
          "<div>" +
          escapeHtml(inspection.generalNotes).replace(/\n/g, "<br>") +
          "</div>" +
          "</div>"
        : "") +
      '<div class="pdf-footer-note">' +
      '<div class="pdf-room-repeat">חדר ' +
      escapeHtml(String(roomNumber)) +
      " · בדיקה " +
      escapeHtml(String(inspection.inspectionNumber)) +
      "</div>" +
      "<div>" +
      escapeHtml(COPYRIGHT()) +
      "</div>" +
      "</div>" +
      "</div>"
    );
  }

  function ensureWorker() {
    let el = document.getElementById("pdf-worker");
    if (!el) {
      el = document.createElement("div");
      el.id = "pdf-worker";
      el.setAttribute("aria-hidden", "true");
      document.body.appendChild(el);
    }
    return el;
  }

  function getHtml2PdfOptions(filename) {
    return {
      margin: [10, 8, 14, 8],
      filename: filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        scrollY: 0,
        scrollX: 0
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-row", "tr"] }
    };
  }

  async function waitForImages(root) {
    const imgs = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      imgs.map(function (img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function (resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  }

  async function createPdfBlob(roomNumber, inspection) {
    if (typeof html2pdf === "undefined") {
      throw new Error("ספריית PDF לא נטענה");
    }
    const filename = pdfFileName(
      roomNumber,
      inspection.inspectionNumber,
      global.Storage.todayISO()
    );
    const worker = ensureWorker();
    worker.innerHTML = buildDocumentHtml(roomNumber, inspection, {
      includeSummary: true
    });
    await waitForImages(worker);

    const opt = getHtml2PdfOptions(filename);
    const workerEl = worker.querySelector(".pdf-root");

    const pdf = await html2pdf().set(opt).from(workerEl).toPdf().get("pdf");

    // Stamp page number + room number on every page
    const total = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const footer =
        "חדר " +
        roomNumber +
        " | בדיקה " +
        inspection.inspectionNumber +
        " | עמוד " +
        i +
        " מתוך " +
        total +
        " | " +
        COPYRIGHT();
      // jsPDF default font won't render Hebrew — draw via html footer already;
      // still add page numbers in Latin digits which always work:
      pdf.text(i + " / " + total, pageW / 2, pageH - 6, { align: "center" });
      pdf.text("Room " + roomNumber, 8, pageH - 6);
      void footer;
    }

    const blob = pdf.output("blob");
    worker.innerHTML = "";
    return { blob: blob, filename: filename, pdf: pdf };
  }

  const PdfService = {
    buildDocumentHtml,
    pdfFileName,

    renderPreview(container, roomNumber, inspection) {
      container.innerHTML = buildDocumentHtml(roomNumber, inspection, {
        includeSummary: true
      });
    },

    async generate(roomNumber, inspection) {
      return createPdfBlob(roomNumber, inspection);
    },

    async download(roomNumber, inspection) {
      const result = await createPdfBlob(roomNumber, inspection);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
      return result;
    },

    async print(roomNumber, inspection) {
      const html = buildDocumentHtml(roomNumber, inspection, {
        includeSummary: true
      });
      const w = window.open("", "_blank");
      if (!w) throw new Error("הדפדפן חסם חלון הדפסה");
      w.document.write(
        "<!DOCTYPE html><html lang=\"he\" dir=\"rtl\"><head><meta charset=\"utf-8\">" +
          "<title>" +
          escapeHtml(
            pdfFileName(roomNumber, inspection.inspectionNumber, global.Storage.todayISO())
          ) +
          "</title>" +
          '<link rel="stylesheet" href="static/css/styles.css">' +
          '<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">' +
          "<style>body{background:#fff;margin:0;padding:12px;}#pdf-worker{position:static!important;left:auto!important;width:auto!important;}</style>" +
          "</head><body>" +
          html +
          "<script>window.onload=function(){setTimeout(function(){window.print();},400);}<\\/script>" +
          "</body></html>"
      );
      w.document.close();
    },

    async share(roomNumber, inspection) {
      const result = await createPdfBlob(roomNumber, inspection);
      const file = new File([result.blob], result.filename, {
        type: "application/pdf"
      });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: result.filename,
          text: "בדיקת חדר " + roomNumber
        });
        return { method: "share", filename: result.filename };
      }

      // Fallback: download
      await this.download(roomNumber, inspection);
      return { method: "download", filename: result.filename };
    },

    /**
     * Full read-only backup PDF of ALL rooms and inspections.
     * Does not mutate Storage / local data.
     */
    async downloadFullBackup() {
      if (typeof html2pdf === "undefined") {
        throw new Error("ספריית PDF לא נטענה");
      }

      const store = global.Storage.getAll();
      const roomNums = Object.keys(store.rooms || {}).sort(function (a, b) {
        const na = Number(a);
        const nb = Number(b);
        if (!isNaN(na) && !isNaN(nb) && String(na) === a && String(nb) === b) {
          return na - nb;
        }
        return String(a).localeCompare(String(b), "he");
      });

      if (!roomNums.length) {
        throw new Error("אין חדרים שמורים ליצירת גיבוי");
      }

      let inspectionCount = 0;
      const sections = [];
      roomNums.forEach(function (roomNumber) {
        const room = store.rooms[roomNumber];
        const inspKeys = Object.keys(room.inspections || {}).sort(function (a, b) {
          return Number(a) - Number(b);
        });
        inspKeys.forEach(function (k) {
          const insp = room.inspections[k];
          if (!insp) return;
          inspectionCount++;
          sections.push({ roomNumber: roomNumber, inspection: insp });
        });
      });

      if (!inspectionCount) {
        throw new Error("אין בדיקות שמורות ליצירת גיבוי");
      }

      const now = new Date();
      const stamp =
        String(now.getDate()).padStart(2, "0") +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        now.getFullYear() +
        "-" +
        String(now.getHours()).padStart(2, "0") +
        "-" +
        String(now.getMinutes()).padStart(2, "0");
      const filename = "WEB-HKR-Full-Rooms-Backup-" + stamp + ".pdf";
      const createdLabel =
        String(now.getDate()).padStart(2, "0") +
        "/" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "/" +
        now.getFullYear() +
        " " +
        String(now.getHours()).padStart(2, "0") +
        ":" +
        String(now.getMinutes()).padStart(2, "0");

      function formatDt(iso) {
        if (!iso) return "—";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return (
          String(d.getDate()).padStart(2, "0") +
          "/" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "/" +
          d.getFullYear() +
          " " +
          String(d.getHours()).padStart(2, "0") +
          ":" +
          String(d.getMinutes()).padStart(2, "0")
        );
      }

      function statusHe(st) {
        return st === "completed" ? "הושלמה" : "בתהליך";
      }

      let html =
        '<div class="pdf-full-backup" dir="rtl">' +
        '<div class="pdf-root pdf-backup-cover">' +
        '<div class="pdf-title">גיבוי מלא — כל החדרים והבדיקות</div>' +
        '<div class="pdf-subtitle">' +
        escapeHtml(global.APP_META.name) +
        "</div>" +
        '<div class="pdf-meta" style="text-align:right;margin-top:16px;">' +
        "<div>תאריך ושעת יצירת הגיבוי: " +
        escapeHtml(createdLabel) +
        "</div>" +
        "<div>מספר חדרים: " +
        roomNums.length +
        "</div>" +
        "<div>מספר בדיקות: " +
        inspectionCount +
        "</div>" +
        "<div>הגיבוי כולל את כל החדרים ללא דילוג, כולל בדיקות בתהליך וחדרים ללא ליקויים.</div>" +
        "</div></div>";

      sections.forEach(function (sec, idx) {
        const roomNumber = sec.roomNumber;
        const inspection = sec.inspection;
        const stats = global.Storage.getStats(inspection);
        const metaLines = [
          "מספר חדר: " + roomNumber,
          "מספר בדיקה: " + inspection.inspectionNumber,
          "מצב הבדיקה: " + statusHe(inspection.status),
          "תאריך הבדיקה: " +
            global.Storage.formatDisplayDate(inspection.date),
          "תאריך יצירת הבדיקה: " + formatDt(inspection.createdAt),
          "עדכון אחרון: " + formatDt(inspection.updatedAt)
        ];
        if (inspection.roomType) {
          metaLines.push("סוג חדר: " + inspection.roomType);
        }
        if (inspection.extraId) {
          metaLines.push("מזהה נוסף: " + inspection.extraId);
        }

        html +=
          '<div class="pdf-root pdf-backup-section" data-room="' +
          escapeHtml(String(roomNumber)) +
          '">' +
          '<div class="pdf-header">' +
          '<div class="pdf-brand">' +
          '<img class="pdf-logo" src="static/IMG/LOGO.png" alt="">' +
          "<div>" +
          '<div class="pdf-title">חדר ' +
          escapeHtml(String(roomNumber)) +
          " — בדיקה " +
          escapeHtml(String(inspection.inspectionNumber)) +
          "</div>" +
          '<div class="pdf-subtitle">' +
          escapeHtml(global.APP_META.formName) +
          " · גיבוי מלא</div>" +
          "</div></div>" +
          '<div class="pdf-meta">' +
          metaLines
            .map(function (line) {
              return "<div>" + escapeHtml(line) + "</div>";
            })
            .join("") +
          "</div></div>" +
          '<div class="pdf-summary">' +
          "<div>פריטים שנבדקו: " +
          stats.checked +
          "</div>" +
          "<div>תקינים: " +
          stats.ok +
          "</div>" +
          "<div>ליקויים: " +
          stats.defects +
          "</div></div>" +
          '<table class="pdf-table"><thead><tr>' +
          "<th>נושא לבדיקה</th><th>תקין</th><th>לא תקין</th><th>הערות</th>" +
          "</tr></thead><tbody>" +
          buildRowsHtml(inspection) +
          "</tbody></table>" +
          (inspection.generalNotes && String(inspection.generalNotes).trim()
            ? '<div class="pdf-general-notes"><h3>הערות כלליות</h3><div>' +
              escapeHtml(inspection.generalNotes).replace(/\n/g, "<br>") +
              "</div></div>"
            : "") +
          '<div class="pdf-footer-note">' +
          '<div class="pdf-room-repeat">חדר ' +
          escapeHtml(String(roomNumber)) +
          " · בדיקה " +
          escapeHtml(String(inspection.inspectionNumber)) +
          " · " +
          statusHe(inspection.status) +
          "</div>" +
          "<div>" +
          escapeHtml(COPYRIGHT()) +
          "</div></div></div>";
        void idx;
      });

      html += "</div>";

      const worker = ensureWorker();
      worker.innerHTML = html;
      await waitForImages(worker);

      const opt = getHtml2PdfOptions(filename);
      opt.pagebreak = {
        mode: ["css", "legacy"],
        before: ".pdf-backup-section",
        avoid: [".pdf-row", "tr", ".pdf-backup-cover"]
      };

      const workerEl = worker.querySelector(".pdf-full-backup");
      const pdf = await html2pdf().set(opt).from(workerEl).toPdf().get("pdf");

      const total = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        pdf.text(i + " / " + total, pageW / 2, pageH - 6, { align: "center" });
        pdf.text("Full backup", 8, pageH - 6);
      }

      const blob = pdf.output("blob");
      worker.innerHTML = "";

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

      return {
        filename: filename,
        rooms: roomNums.length,
        inspections: inspectionCount
      };
    },

    /**
     * Management meeting weekly summary PDF.
     * options: { bounds: {startISO,endISO}, rows: [{roomNumber,inspection,stats,blocking}] }
     */
    async downloadWeeklySummary(options) {
      if (typeof html2pdf === "undefined") {
        throw new Error("ספריית PDF לא נטענה");
      }
      const opts = options || {};
      const bounds = opts.bounds || {};
      const rows = opts.rows || [];
      if (!rows.length) throw new Error("אין נתונים לסיכום שבועי");

      function pad2(n) {
        return String(n).padStart(2, "0");
      }
      function esc(s) {
        return String(s == null ? "" : s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }
      function fmtDate(iso) {
        if (!iso) return "—";
        const p = String(iso).split("-");
        if (p.length !== 3) return esc(iso);
        return p[2] + "/" + p[1] + "/" + p[0];
      }

      const now = new Date();
      const stamp =
        pad2(now.getDate()) +
        "-" +
        pad2(now.getMonth() + 1) +
        "-" +
        now.getFullYear();
      const filename = "WEB-HKR-Weekly-Summary-" + stamp + ".pdf";

      let defectTotal = 0;
      let blocking = 0;
      let completed = 0;
      rows.forEach(function (r) {
        defectTotal += r.stats.defects || 0;
        if (r.blocking) blocking++;
        if (r.inspection.status === "completed") completed++;
      });

      let body = "";
      rows.forEach(function (r) {
        const defects =
          r.stats.defectList && r.stats.defectList.length
            ? "<ul>" +
              r.stats.defectList
                .map(function (d) {
                  return (
                    "<li" +
                    (d.blocking ? " style='color:#b42318'" : "") +
                    "><b>" +
                    esc(d.itemName) +
                    "</b> (" +
                    esc(d.categoryName) +
                    ")" +
                    (d.blocking ? " — מונע איכלוס" : "") +
                    (d.note ? " — " + esc(d.note) : "") +
                    "</li>"
                  );
                })
                .join("") +
              "</ul>"
            : "<div style='color:#666'>אין ליקויים</div>";

        body +=
          '<div style="margin:12px 0 16px;padding:10px;border:1px solid #ccc;border-radius:8px;page-break-inside:avoid">' +
          "<div><b>חדר " +
          esc(r.roomNumber) +
          "</b> · בדיקה " +
          r.inspection.inspectionNumber +
          " · " +
          fmtDate(r.inspection.date) +
          " · " +
          (r.inspection.status === "completed" ? "הושלמה" : "בתהליך") +
          (r.blocking ? " · <span style='color:#b42318'>מונע איכלוס</span>" : "") +
          "</div>" +
          "<div>ליקויים: " +
          r.stats.defects +
          "</div>" +
          defects +
          "</div>";
      });

      const html =
        '<div class="pdf-root pdf-weekly" dir="rtl" style="font-family:Heebo,Arial,sans-serif;color:#111;padding:8px">' +
        "<h1 style='color:#0b3a4a;margin:0 0 6px'>הלו״ז השבועי — The Yacht</h1>" +
        "<div style='margin-bottom:10px;color:#5a6f78'>" +
        fmtDate(bounds.startISO) +
        " – " +
        fmtDate(bounds.endISO) +
        " (א׳–ש׳)</div>" +
        "<div style='margin-bottom:14px'>בדיקות: " +
        rows.length +
        " · הושלמו: " +
        completed +
        " · סה״כ ליקויים: " +
        defectTotal +
        " · מונע איכלוס: " +
        blocking +
        " חדרים</div>" +
        body +
        "<div style='margin-top:16px;font-size:11px;color:#5a6f78'>" +
        esc(COPYRIGHT()) +
        "</div></div>";

      const worker = document.getElementById("pdf-worker");
      worker.innerHTML = html;
      const root = worker.querySelector(".pdf-weekly");

      const opt = {
        margin: [10, 10, 14, 10],
        filename: filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      };

      const pdf = await html2pdf().set(opt).from(root).toPdf().get("pdf");
      const blob = pdf.output("blob");
      worker.innerHTML = "";

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

      return { filename: filename, rows: rows.length };
    }
  };

  global.PdfService = PdfService;
})(window);
