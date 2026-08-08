# © הזכויות שמורות ל-MP מיכאל פפיסמדוב 2001

# סנכרון ענן אופציונלי (Supabase Free)

ההתחברות במסך נשארת: **MP2001 / 1234**.  
הענן הוא תוספת שקטה לסנכרון בין טלפון למחשב.

## מתי זה פעיל?
רק אם ממלאים ב־`static/js/supabase-config.js`:
- `url`
- `anonKey`
- `cloudEmail` (אימייל של משתמש יחיד ב־Supabase)

אם השדות ריקים — האפליקציה עובדת מקומית בלבד (בלי הודעות שגיאה חוסמות).

## הגדרה חד־פעמית
1. צרו פרויקט Supabase Free  
2. הריצו את `supabase/schema.sql` ב־SQL Editor  
3. Authentication → Providers → Email → כבו Confirm email  
4. צרו משתמש עם אותו אימייל שב־`cloudEmail` ואותה סיסמה שבאפליקציה (`1234`)  
   (או התחברו פעם אחת — האפליקציה מנסה גם signUp אוטומטי)  
5. הדביקו URL + anon key ב־`supabase-config.js`  
6. Deploy מחדש ל־Vercel

**אל תשימו** `service_role` או Secret Key בקוד.
