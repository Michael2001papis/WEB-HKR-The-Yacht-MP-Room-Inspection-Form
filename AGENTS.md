# The Yacht — Room Inspection App

A static, client-side single-page web app (Hebrew, RTL) for digital hotel room inspections. Plain HTML/CSS/vanilla JS with no build step, no package manager, and no backend. Inspection data persists in the browser's `localStorage`; PDF export uses `html2pdf.js` loaded from a CDN.

## Cursor Cloud specific instructions

- There is no build, no dependency install, no test suite, and no linter configured. The "dev environment" is just an HTTP server for the static files. Do not add a package manager or build tooling unless the task explicitly asks for it.
- Serve the app over HTTP (not `file://`) so relative asset paths and `localStorage` behave correctly. From the repo root: `python3 -m http.server 8000`, then open `http://localhost:8000/index.html`. Node (`v22`) is also available if you prefer `npx http-server`.
- Core flow to smoke-test: Home (`מסך הבית`) → `בדיקת חדר חדשה` (new inspection) → enter room number → `התחלת בדיקה` → mark items (or `כל החדר תקין`) → `מעבר לסיכום` → `סיום ושמירה`.
- State lives entirely in `localStorage` under the key `yacht-room-inspections-v1`. To reset the app to a clean state, clear site data / that key in the browser; there is no server-side state.
- PDF export (`html2pdf.js`) is loaded from `cdnjs.cloudflare.com`, so PDF generation needs outbound network access; the rest of the app works fully offline.
