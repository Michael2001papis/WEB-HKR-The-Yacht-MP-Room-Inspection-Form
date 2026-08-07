# הגדרת Supabase Free + התחברות בשם משתמש (MP2001)

## עקרון אבטחה
- האפליקציה מציגה **MP2001**
- מאחורי הקלעים Supabase Auth עובד עם **אימייל תקין**
- הסיסמה מוזנת רק במסך ההתחברות — **לא** נשמרת ב־JS / GitHub / Vercel
- ה־JWT נוצר ומנוהל **רק** ע״י Supabase אחרי התחברות מוצלחת
- נתוני חדרים משויכים ל־`auth.uid()` עם RLS

## 1. פרויקט Free
1. https://supabase.com → New project (Free)
2. SQL Editor → הריצו את `supabase/schema.sql`

## 2. אימייל (לבדיקות)
Authentication → Providers → Email → כבו Confirm email

## 3. מפתחות ציבוריים + מיפוי MP2001
ב־`static/js/supabase-config.js`:

```js
global.SUPABASE_CONFIG = {
  url: "https://XXXX.supabase.co",
  anonKey: "eyJhbGciOi...",
  usernameAccounts: {
    MP2001: {
      email: "your-real-email@example.com"
    }
  }
};
```

**אסור** להכניס סיסמה או `service_role` לקובץ הזה.

## 4. יצירת החשבון (פעם אחת)
באפליקציה:
1. שם משתמש: `MP2001`
2. סיסמה לבחירתכם (רק במסך — לא בקוד)
3. «יצירת חשבון» או «התחברות» אם כבר נוצר ב־Dashboard

אפשר גם ליצור משתמש ב־Supabase Dashboard → Authentication → Users עם אותו אימייל, ואז להתחבר באפליקציה כ־MP2001.

## 5. מה קורה בהתחברות
1. המשתמש מקליד `MP2001` + סיסמה
2. האפליקציה ממירה לאימייל מה־config
3. קוראת ל־`signInWithPassword` של Supabase
4. Supabase מחזיר Session/JWT ושומר אותו בדפדפן
5. המסך מציג `MP2001`
6. שמירת חדרים משתמשת ב־User ID מה־JWT + RLS
