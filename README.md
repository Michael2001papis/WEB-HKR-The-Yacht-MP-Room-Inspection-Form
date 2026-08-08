# בדיקת חדרים — The Yacht (WEB-HKR)

© הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001

אפליקציית ווב בעברית (RTL) לבדיקת חדרים במלון **The Yacht**.  
מחליפה טפסי נייר: סימון תקין / לא תקין, הערות, שמירה אוטומטית במכשיר ויצירת PDF.

| | |
|---|---|
| **אתר חי (Vercel)** | https://web-hkr-the-yacht-mp-room-inspectio.vercel.app |
| **GitHub** | https://github.com/Michael2001papis/WEB-HKR-The-Yacht-MP-Room-Inspection-Form |

---

## מה האפליקציה יודעת לעשות

- בדיקת חדר חדשה (בדיקה 1 / בדיקה 2)
- המשך בדיקה בתהליך
- חדרים שמורים + חיפוש לפי מספר חדר
- סימון לפי פריט / קטגוריה / כל החדר תקין
- הערות לפריטים + הערות כלליות
- שמירה אוטומטית במכשיר (localStorage)
- PDF לחדר בודד + גיבוי מלא ל־PDF
- התחברות מקומית עם שם משתמש + סיסמה (משתמש יחיד: **MP2001**)

---

## טכנולוגיה

| שכבה | פרטים |
|------|--------|
| Frontend | HTML + JavaScript סטטי (ללא build) |
| עיצוב | CSS מותאם, RTL, עברית |
| Auth | התחברות מקומית (`MP2001`) + סנכרון ענן אופציונלי |
| שמירה | **IndexedDB פנימי** (YachtDB) + מראת localStorage |
| PDF | html2pdf.js (בדפדפן) |
| Hosting | Vercel |

---

## התחברות

| שדה | ערך |
|-----|------|
| שם משתמש | `MP2001` |
| סיסמה | `1234` |

רק הצירוף הזה מאפשר כניסה. אין יצירת חשבון ואין Supabase Auth.

אחרי **90 דקות ללא שימוש** מתבצעת התנתקות אוטומטית (צריך להתחבר מחדש). הנתונים במכשיר נשמרים.

### סנכרון טלפון ↔ מחשב (אופציונלי)
מלאו `url` + `anonKey` + `cloudEmail` ב־`static/js/supabase-config.js` לפי [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md).  
בלי זה האפליקציה ממשיכה לעבוד מקומית בלבד.

הגדרות התחברות: `static/js/auth.js`.

---

## מבנה הפרויקט

```
index.html                 # ממשק האפליקציה (כל המסכים)
static/
  css/styles.css
  js/
    checklist-data.js      # רשימת ריג'קטים + APP_META
    db.js                  # מסד נתונים פנימי IndexedDB (YachtDB)
    storage.js             # שכבת שמירה (זיכרון + DB + מראה)
    sync.js                # שכבת סנכרון (לא פעילה בלי Supabase)
    auth.js                # התחברות מקומית MP2001
    supabase-config.js     # ריק / מכובה
    supabase-client.js
    pdf.js                 # PDF חדר + גיבוי מלא
    app.js                 # ניווט ומסכים
  IMG/                     # לוגו ורקעים
  assets/
README.md
```

---

## הרצה מקומית

אפליקציה סטטית — אין צורך ב־`npm install` או build.

```bash
git clone https://github.com/Michael2001papis/WEB-HKR-The-Yacht-MP-Room-Inspection-Form.git
cd WEB-HKR-The-Yacht-MP-Room-Inspection-Form
```

מומלץ לשרת מקומי (Live Server / `npx serve`), ואז לפתוח בדפדפן ולהתחבר כ־`MP2001` / `1234`.

---

## פריסה

הפרויקט מחובר ל־**Vercel**.  
דחיפה ל־`main` מפרסמת לפרודקשן.

---

## הערות חשובות

- רשימת הריג'קטים ב־`checklist-data.js` — אין לשנות ניסוח בלי אישור מפורש
- PDF נוצר בדפדפן ונשמר במכשיר
- הנתונים נשמרים במכשיר (localStorage) — לא בענן
- מסך ההתחברות מותאם למובייל (כולל Galaxy S22 Ultra), טאבלט ומחשב

---

## רישיון / זכויות

© הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001
