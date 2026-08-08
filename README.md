# בדיקת חדרים — The Yacht (WEB-HKR)

אפליקציית ווב בעברית (RTL) לבדיקת חדרים במלון **The Yacht**.  
מחליפה טפסי נייר: סימון תקין / לא תקין, הערות, שמירה אוטומטית, סנכרון בענן ויצירת PDF.

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
- שמירה אוטומטית (offline-first)
- PDF לחדר בודד + גיבוי מלא ל־PDF
- התחברות עם שם משתמש מוצג (למשל **MP2001**) דרך Supabase Auth
- סנכרון בענן (Supabase Free) עם רשת ביטחון מקומית

---

## טכנולוגיה

| שכבה | פרטים |
|------|--------|
| Frontend | HTML + JavaScript סטטי (ללא build) |
| עיצוב | CSS מותאם, RTL, עברית |
| Auth / DB | Supabase Free (Auth + Postgres + RLS) |
| PDF | html2pdf.js (בדפדפן) |
| Hosting | Vercel |

---

## שמירה והתחברות (Supabase Free)

| נושא | איך זה עובד |
|------|-------------|
| שם מוצג באפליקציה | למשל `MP2001` |
| Auth מאחורי הקלעים | אימייל תקין ב־Supabase Auth |
| סיסמה | מוזנת רק במסך ההתחברות — **לא** נשמרת בקוד / GitHub / Vercel |
| JWT / Session | נוצרים ומנוהלים **רק** ע״י Supabase |
| הפרדת משתמשים | כל רשומה עם `user_id`; **RLS** מגביל ל־`auth.uid()` |
| Offline | שינוי → שמירה מקומית מיד → סנכרון ל־Supabase כשיש רשת |
| נתונים ישנים | אחרי התחברות אפשר להעביר מ־`localStorage` הישן (בלי מחיקה אוטומטית) |

מדריך מפורט: [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)  
סכמת DB + RLS: [`supabase/schema.sql`](./supabase/schema.sql)

### הגדרה קצרה

1. צרו פרויקט **Supabase Free**
2. הריצו את `supabase/schema.sql` ב־SQL Editor
3. (מומלץ לבדיקות) כבו Confirm email ב־Authentication → Providers → Email
4. מלאו ב־`static/js/supabase-config.js`:

```js
global.SUPABASE_CONFIG = {
  url: "https://XXXX.supabase.co",
  anonKey: "eyJhbGciOi...", // anon/public בלבד
  usernameAccounts: {
    MP2001: {
      email: "your-real-email@example.com"
    }
  }
};
```

5. פתחו את האתר → שם משתמש `MP2001` + סיסמה → יצירת חשבון / התחברות

**אסור** להכניס לקוד: `service_role`, Secret Key, או סיסמאות.

---

## מבנה הפרויקט

```
index.html                 # ממשק האפליקציה (כל המסכים)
static/
  css/styles.css
  js/
    checklist-data.js      # רשימת ריג'קטים + APP_META
    storage.js             # Cache מקומי לפי משתמש
    sync.js                # סנכרון offline-first ל־Supabase
    auth.js                # התחברות / Session / מיפוי שם משתמש
    supabase-config.js     # URL + anon key + מיפוי MP2001→אימייל
    supabase-client.js
    pdf.js                 # PDF חדר + גיבוי מלא
    app.js                 # ניווט ומסכים
  IMG/                     # לוגו ורקעים
  assets/
supabase/schema.sql        # טבלת inspections + RLS
SUPABASE_SETUP.md
README.md
```

---

## הרצה מקומית

אפליקציה סטטית — אין צורך ב־`npm install` או build.

```bash
git clone https://github.com/Michael2001papis/WEB-HKR-The-Yacht-MP-Room-Inspection-Form.git
cd WEB-HKR-The-Yacht-MP-Room-Inspection-Form
```

מומלץ לשרת מקומי (Live Server / `npx serve`) — Auth של Supabase עובד טוב יותר מ־`localhost` מאשר מ־`file://`.

1. מלאו את `static/js/supabase-config.js`
2. פתחו את האתר בדפדפן
3. התחברו כ־`MP2001`

---

## פריסה

הפרויקט מחובר ל־**Vercel**.  
דחיפה ל־`main` מפרסמת לפרודקשן.

אחרי שינוי ב־`supabase-config.js` יש לדחוף שוב ל־GitHub כדי שהאתר החי יתעדכן.

---

## אבטחה — סיכום

- מפתח ציבורי (`anon`) בלבד בצד הלקוח
- RLS על טבלת `inspections`
- אין גישה אנונימית לנתוני חדרים
- אין JWT ידני
- אין סיסמאות בקוד המקור

---

## הערות חשובות

- רשימת הריג'קטים ב־`checklist-data.js` — אין לשנות ניסוח בלי אישור מפורש
- PDF נוצר בדפדפן ונשמר במכשיר; בשלב זה אין העלאת PDF ל־Supabase Storage
- פרויקט Free של Supabase עשוי להיכנס ל־Pause אחרי כשבוע ללא פעילות — הנתונים המקומיים לא נמחקים במקרה כזה

---

## רישיון / זכויות

© כל הזכויות שמורות
