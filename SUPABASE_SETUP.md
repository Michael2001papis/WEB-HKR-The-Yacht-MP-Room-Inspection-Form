# הגדרת Supabase Free (חובה לפני שימוש)

## 1. יצירת פרויקט
1. https://supabase.com → New project
2. תוכנית **Free** בלבד

## 2. הרצת הסכמה
SQL Editor → הדביקו את `supabase/schema.sql` → Run

## 3. אימות אימייל (מומלץ לבדיקות)
Authentication → Providers → Email → כבו Confirm email

## 4. מפתחות ציבוריים בלבד
Project Settings → API → העתיקו ל־`static/js/supabase-config.js`:

```js
global.SUPABASE_CONFIG = {
  url: "https://XXXX.supabase.co",
  anonKey: "eyJhbGciOi..."
};
```

**אסור** להכניס `service_role` לקוד האתר.
