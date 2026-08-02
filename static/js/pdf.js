/**
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
    }
  };

  global.PdfService = PdfService;
})(window);
