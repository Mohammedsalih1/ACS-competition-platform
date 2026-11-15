# إعداد قاعدة البيانات على Supabase

هذا المشروع يستخدم Prisma مع PostgreSQL. ترحيل `20261109213217_init` ينشئ الجداول `areas` و`comunity_updates` و`schedules` ونوع الحالة `Status`، ولا ينقل بيانات من قاعدة محلية.

## الخطوات

1. أنشئ مشروعًا في Supabase، ثم افتح **Connect** وانسخ رابط PostgreSQL من قسم **Session pooler**. استخدم المنفذ `5432`، وليس رابط Transaction pooler ذي المنفذ `6543`.
2. انسخ `.env.example` إلى `.env` داخل مجلد `server`، ثم استبدل `DATABASE_URL` برابط الاتصال الذي نسخته. لا ترفع `.env` إلى Git ولا تشارك كلمة المرور.
3. من مجلد `server` شغّل:

   ```sh
   npm run db:deploy
   ```

4. للتحقق من حالة الترحيلات:

   ```sh
   npm run db:status
   ```

5. شغّل الخادم بالطريقة المعتادة باستخدام `npm run dev`.

## النشر على Render

أنشئ **Web Service** من المستودع واضبط:

- **Root Directory:** `server`
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`
- **Environment:** أضف `DATABASE_URL` في إعدادات الخدمة مستخدمًا رابط Supabase، واختر إصدار Node.js `22.18.0` أو أحدث.

لا تستخدم `npm run dev` في Render؛ هذا الأمر مخصص للتطوير المحلي. يستمع الخادم تلقائيًا إلى المنفذ الذي يحدده Render عبر `PORT`.

إذا احتوت قاعدة البيانات الحالية على بيانات تريد الاحتفاظ بها، لا تستخدم هذا الترحيل كنسخة احتياطية؛ صدّر البيانات المحلية واستوردها منفصلًا بعد إنشاء الجداول.
