# 🧪 دليل اختبار نظام OTP والتسجيل

## المتطلبات قبل الاختبار

1. **التأكد من تشغيل السيرفر:**
   ```bash
   # في مجلد backend
   python server.py
   # يجب أن يظهر: Uvicorn running on http://127.0.0.1:8000
   ```

2. **التأكد من تشغيل تطبيق React:**
   ```bash
   # في مجلد frontend
   npm start
   # يجب أن يفتح http://localhost:3000
   ```

3. **التأكد من إعدادات البريد (SMTP):**
   - تحقق من ملف `.env` أو `config.py`
   - يجب أن يكون BREVO مُشغّل أو بريد آخر

---

## 📝 السيناريو 1: تسجيل مستخدم جديد كامل

### خطوات الاختبار:

**1. الوصول لصفحة التسجيل:**
```
1. اذهب إلى http://localhost:3000/register
2. يجب أن ترى صفحة "Join SyrLink" بنموذج التسجيل
```

**2. ملء البيانات:**
```
- Full name: أحمد محمد
- Email: ahmed.test+001@gmail.com  (تأكد أنه إيميل جديد لم يتم استخدامه)
- Password: SecurePassword123
- Headline: Software Engineer (اختياري)
```

**3. النقر على "Agree & Join":**
```
✅ المتوقع:
- رسالة "Account created! Please verify your email"
- توجيه تلقائي لـ /verify-otp?email=ahmed.test%2B001@gmail.com
- ظهور صفحة تطلب إدخال الرمز
```

**4. التحقق من استقبال الإيميل:**
```
✅ يجب أن تستقبل إيميل يحتوي على:
- "Verify your email"
- رمز 6 أرقام (مثل: 123456)
- الشعار والرسالة الترحيبية
```

**5. إدخال الرمز:**
```
1. انسخ الرمز من الإيميل
2. ألصقه في حقل "Verification Code"
3. يجب أن يقبل فقط 6 أرقام
4. اضغط "Verify Code"
```

**6. النتيجة المتوقعة:**
```
✅ رسالة: "✓ Email verified successfully! Redirecting to login..."
✅ توجيه تلقائي لصفحة /login بعد ثانيتين
```

**7. تسجيل الدخول:**
```
1. استخدم نفس البريد والكلمة المرور
2. اضغط "Sign in"

✅ يجب أن تدخل الصفحة الرئيسية /feed
```

---

## ❌ السيناريو 2: محاولة تسجيل بنفس البريد

### خطوات الاختبار:

**1. العودة لصفحة التسجيل:**
```
http://localhost:3000/register
```

**2. محاولة التسجيل بنفس البريد المفعّل:**
```
- Email: ahmed.test+001@gmail.com  (من السيناريو السابق)
- ملء البيانات الأخرى بشكل طبيعي
- اضغط "Agree & Join"
```

**3. النتيجة المتوقعة:**
```
❌ رسالة خطأ: "This email is already registered. Please login instead."
❌ البقاء على نفس الصفحة (لا توجيه)
```

---

## ⚠️ السيناريو 3: رمز OTP خاطئ

### خطوات الاختبار:

**1. تسجيل مستخدم جديد:**
```
- استخدم إيميل جديد: test.wrong.otp@gmail.com
- ملء البيانات والنقر "Agree & Join"
```

**2. على صفحة verify-otp:**
```
1. بدلاً من إدخال الرمز الصحيح
2. أدخل رمز خاطئ: 999999
3. اضغط "Verify Code"
```

**3. النتيجة المتوقعة:**
```
❌ رسالة خطأ: "❌ Invalid or expired code. Request a new one."
❌ البقاء على صفحة verify-otp
✅ توفر خيار "Send New Code"
```

---

## 🔄 السيناريو 4: طلب رمز جديد (Resend OTP)

### خطوات الاختبار:

**1. على صفحة verify-otp:**
```
1. بدلاً من إدخال الرمز
2. اضغط زر "Send New Code"
```

**2. النتيجة المتوقعة:**
```
✅ رسالة: "✓ New code sent to your email!"
✅ الزر يتحول إلى: "Resend Code (60s)"
✅ عد تنازلي من 60 إلى 0 ثانية
✅ رمز جديد يصل للإيميل
```

**3. بعد انتهاء الـ Countdown:**
```
✅ الزر يعود لـ "Send New Code"
✅ يمكن طلب رمز جديد مرة أخرى
```

---

## 🔓 السيناريو 5: البريد مفعّل بالفعل

### خطوات الاختبار:

**1. التسجيل بنفس البريد مرتين (من السيناريو 1):**
```
- السيناريو 1: تسجيل وتفعيل البريد
- الآن: محاولة التسجيل بنفس البريد مرة أخرى
```

**2. على صفحة verify-otp:**
```
1. بعد التحقق الأول، البريد أصبح مفعّل
2. حاول التسجيل بنفس البريد من جديد
3. سيظهر خطأ في Register.jsx:
   "This email is already registered. Please login instead."
```

**3. البديل: طلب resend للبريد المفعّل:**
```
1. إذا حاولت /verify-otp للبريد المفعّل مباشرة
2. اضغط "Send New Code"

✅ رسالة: "Your email is already verified! You can now login."
✅ رابط: "Go to Login"
```

---

## 🌐 السيناريو 6: اختبار متصفحات متعددة

### خطوات الاختبار:

**1. في Chrome:**
```
- تسجيل: user1@example.com
- التحقق والدخول
```

**2. في Firefox (في نفس الوقت):**
```
- تسجيل: user2@example.com
- التحقق والدخول
```

**3. النتيجة المتوقعة:**
```
✅ عمل كلا التسجيلين بشكل منفصل
✅ لا تضارب في قاعدة البيانات
```

---

## 🔍 اختبار الـ Logging

### من جهة Backend:

**عند التسجيل:**
```
[register] 📨 Starting registration for: ahmed@example.com
[register] ✓ Email is new, creating user: ahmed@example.com
[register] 🔐 Generated OTP: 123456
[register] ✓ OTP sent successfully to ahmed@example.com
[register] ✅ Registration completed successfully: ahmed@example.com
```

**عند التحقق:**
```
[verify-otp] 🔐 Verifying OTP for: ahmed@example.com
[verify-otp] ✓ OTP is valid for ahmed@example.com
[verify-otp] ✅ Email verified successfully: ahmed@example.com
```

**عند الأخطاء:**
```
[register] ❌ Email already exists in database: duplicate@example.com
[verify-otp] ❌ Invalid or expired OTP for ahmed@example.com
```

### من جهة Frontend (في Console):

**عند التسجيل:**
```
[Register] 📨 Attempting to register: { name: "Ahmed", email: "ahmed@example.com" }
[Register] ✅ Registration successful: { ok: true, ... }
```

**عند التحقق:**
```
[VerifyOtp] 📧 Email from URL: ahmed@example.com
[VerifyOtp] 🔐 Verifying OTP for: ahmed@example.com
[VerifyOtp] ✅ Verification successful: { ok: true, user: {...} }
```

---

## 🚨 حالات الأخطاء والمعالجة

### الخطأ 1: البريد غير صحيح
```
❌ رسالة Frontend: "Email already registered"
✅ الحل: تحقق من البريد المدخل
```

### الخطأ 2: الإيميل لم يصل
```
⚠️ المشكلة: لم تستقبل الإيميل
✅ الحل: اضغط "Send New Code" على صفحة verify-otp
```

### الخطأ 3: الرمز منتهي الصلاحية (أكثر من 10 دقائق)
```
❌ رسالة: "Invalid or expired OTP"
✅ الحل: اضغط "Send New Code" للحصول على رمز جديد
```

### الخطأ 4: مشاكل الاتصال (Connection Timeout)
```
❌ رسالة: "Network error"
✅ الحل: تأكد من الإنترنت وحاول مرة أخرى
✅ الحساب قد يكون تم إنشاؤه رغم الخطأ - جرب /verify-otp
```

---

## ✅ Checklist النهائي

قبل تسليم المشروع، تأكد من:

- [ ] ✅ تسجيل مستخدم جديد يعمل بدون أخطاء
- [ ] ✅ صفحة verify-otp تظهر بشكل صحيح
- [ ] ✅ إدخال الرمز الصحيح ينجح في التحقق
- [ ] ✅ إدخال الرمز الخاطئ يعطي رسالة خطأ
- [ ] ✅ زر "Send New Code" يعمل مع countdown
- [ ] ✅ محاولة تسجيل بنفس البريد تعطي خطأ واضح
- [ ] ✅ الإيميلات تصل بشكل صحيح
- [ ] ✅ الـ Logging يظهر جميع العمليات
- [ ] ✅ التوجيه صحيح بين الصفحات
- [ ] ✅ لا توجد رسائل console errors
- [ ] ✅ الواجهة تبدو احترافية وسهلة الاستخدام
- [ ] ✅ اختبار من متصفحات/أجهزة متعددة

---

## 📞 الدعم والمشاكل

إذا واجهت مشكلة:

1. **تحقق من الـ Backend Logs**
   ```bash
   # في مجلد backend
   # ابحث عن رسائل [register] أو [verify-otp]
   ```

2. **افتح Developer Tools**
   ```
   اضغط F12 في المتصفح
   انظر لـ Console و Network tabs
   ```

3. **تحقق من الإعدادات**
   ```
   - هل Backend يعمل على http://127.0.0.1:8000?
   - هل Frontend يعمل على http://localhost:3000?
   - هل SMTP مشغّل وتفاصيل صحيحة؟
   ```

---

