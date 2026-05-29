import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const getCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const regex = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = regex.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : '';
};

const setCookie = (name, value, options = {}) => {
  if (typeof document === 'undefined') return;
  const opts = { path: '/', sameSite: 'Lax', ...options };
  let cookieString = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge) cookieString += `; max-age=${opts.maxAge}`;
  if (opts.path) cookieString += `; path=${opts.path}`;
  if (opts.sameSite) cookieString += `; samesite=${opts.sameSite}`;
  if (opts.secure) cookieString += `; secure`;
  document.cookie = cookieString;
};

export default function NDA() {
  const [cookieConsent, setCookieConsent] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);

  useEffect(() => {
    const consent = getCookie('li_cookie_consent') === 'yes';
    setCookieConsent(consent);
    setShowCookieModal(!consent);
  }, []);

  const acceptCookies = () => {
    setCookie('li_cookie_consent', 'yes', { maxAge: 31536000 });
    setCookieConsent(true);
    setShowCookieModal(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">SyrLink</h1>
          <Link to="/login" className="text-[#0a66c2] hover:underline">العودة إلى تسجيل الدخول</Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 sm:p-10 text-right" dir="rtl">
        <div className="rounded-lg bg-white shadow-sm border p-5 mb-6">
          <h1 className="text-2xl font-bold">اتفاقية عدم الإفصاح (NDA) - منصة SyrLink</h1>
          <p className="text-sm text-gray-600 mt-2">آخر تحديث: 03/12/47 10:15 م</p>
        </div>

        <div className="prose prose-invert max-w-none leading-relaxed">
          <h2>اتفاقية عدم الإفصاح (NDA)</h2>
          <p>تشكل هذه اتفاقية عدم الإفصاح والسرية جزءاً لا يتجزأ من شروط الاستخدام والسياسة القانونية العامة الخاصة بمنصة SyrLink.</p>
          <p>يُعد استخدام أي شخص أو جهة للمنصة، بأي صورة كانت، بما في ذلك الدخول أو التصفح أو إنشاء حساب أو استخدام أي من الخدمات أو الميزات المتاحة عبر المنصة، قبولاً صريحاً ونهائياً بأحكام هذه الاتفاقية.</p>
          <p>منصة SyrLink تحترم سرية المعلومات والبيانات الخاصة بمستخدميها والشركات والجهات المتفاعلة معها.</p>

          <h3>أولاً: الديباجة والتعاريف</h3>
          <p>تشكل هذه اتفاقية عدم الإفصاح والسرية ("الاتفاقية") جزءاً لا يتجزأ من شروط الاستخدام والسياسة القانونية العامة الخاصة بمنصة SyrLink، وهي منصة رقمية مهنية سورية تُعنى بربط المهنيين وأصحاب المشاريع والشركات والمستثمرين، وتيسير التواصل والتعاون والتوظيف والفرص الاستثمارية عبر الإنترنت.</p>

          <h3>ثانياً: نطاق الاتفاقية وتطبيقها</h3>
          <p>تُعد هذه الاتفاقية جزءاً لا يتجزأ من شروط الاستخدام والسياسات القانونية الأخرى الخاصة بمنصة SyrLink، وتُفسَّر وتُطبَّق معها كوحدة واحدة.</p>
          <p>تسري أحكام هذه الاتفاقية على جميع المستخدمين، أفراداً كانوا أو شركات أو مؤسسات أو مستثمرين أو أصحاب مشاريع أو ممثلين عن جهات اعتبارية.</p>

          <h3>ثالثاً: طبيعة المعلومات السرّية المشمولة بالحماية</h3>
          <p>يقر المستخدم ويوافق على أن نطاق المعلومات السرّية المشمولة بهذه الاتفاقية واسع ويشمل البيانات والمحتويات التجارية والمهنية، بيانات المستخدمين الشخصية وغير الشخصية، والمعلومات غير المنشورة للعامة.</p>

          <h3>رابعاً: التزامات منصة SyrLink في مجال السرية</h3>
          <p>تلتزم SyrLink بعدم بيع بيانات المستخدمين أو الشركات أو أي معلومات سرّية أو شخصية متاحة عبر المنصة لأي طرف ثالث، وعدم المتاجرة بها بصورة مباشرة أو غير مباشرة.</p>
          <p>لا تشارك البيانات مع أي طرف ثالث إلا في الحالات الضرورية لتقديم الخدمات أو تشغيل المنصة أو الامتثال للالتزامات القانونية أو التنظيمية، مع السعي إلى إخفاء أو تقليل البيانات التعريفية عند الإمكان.</p>

          <h3>خامساً: التزامات المستخدمين في مجال عدم الإفصاح</h3>
          <p>يُلتزم المستخدم بعدم مشاركة أو إفشاء أو نقل أو نشر أو بيع أو إتاحة أي من المعلومات السرّية التي يطّلع عليها من خلال المنصة لأي طرف ثالث، إلا بموافقة صريحة ومسبقة وواضحة من صاحب المعلومة المعني أو من خلال أدوات المنصة المصرح بها.</p>

          <h3>سادساً: الاستثناءات الواردة على الالتزام بالسرية</h3>
          <p>لا ينطبق الالتزام بالسرية على المعلومات التي كانت متاحة للعامة بصورة مشروعة وخارج المنصة، أو التي حصل عليها المستخدم بصورة مستقلة من مصدر آخر، أو التي طُلب الإفصاح عنها بموجب قانون ساري أو قرار قضائي.</p>

          <h3>سابعاً: نطاق استخدام المعلومات داخل المنصة</h3>
          <p>تمنح SyrLink للمستخدمين رخصة محدودة وغير حصرية لاستخدام المعلومات المتاحة لهم عبر المنصة للأغراض المهنية المشروعة فقط، مثل التقديم على وظائف أو التواصل المهني أو دراسة الفرص الاستثمارية.</p>

          <h3>ثامناً: حماية الحساب وبيانات الدخول</h3>
          <p>يلتزم المستخدم بالحفاظ على سرية بيانات الدخول إلى حسابه واتخاذ التدابير المعقولة لحماية أجهزته من الوصول غير المصرح به.</p>

          <h3>تاسعاً: حظر نقل أو ترخيص حقوق الوصول إلى الحساب أو البيانات</h3>
          <p>لا يجوز للمستخدم تأجير أو إعارة أو بيع أو ترخيص أو التنازل عن حسابه أو صلاحيات الوصول إلى أي طرف ثالث.</p>

          <h3>عاشراً: الإخلال بالاتفاقية والعقوبات المترتبة</h3>
          <p>يُعتبر أي خرق من جانب المستخدم للالتزامات الواردة إخلالاً جوهرياً يخول SyrLink اتخاذ التدابير المناسبة، بما في ذلك تعليق أو إغلاق الحساب والمطالبة بالتعويض عن الأضرار.</p>

          <h3>تاسعاً: مدة الاتفاقية وإنهاؤها</h3>
          <p>تسري هذه الاتفاقية منذ لحظة استخدام المنصة وتستمر الالتزامات المتعلقة بالسرية بعد إغلاق الحساب لفترة لا تقل عن خمس (5) سنوات أو المدة الأطول المنصوص عليها في شروط أخرى.</p>

          <h3>عاشراً: القانون الواجب التطبيق والاختصاص القضائي</h3>
          <p>تخضع هذه الاتفاقية لأحكام قوانين الجمهورية العربية السورية، وتخضع الخلافات للاختصاص القضائي للمحاكم السورية المختصة، مع تشجيع الحلول الودية والتحكيم عند الاتفاق عليه.</p>

          <p className="mt-6">باستخدامك لمنصة SyrLink، فإنك تقر بأنك قد قرأت هذه اتفاقية عدم الإفصاح (NDA) وفهمت مضمونها، وتوافق على الالتزام التام بجميع أحكامها وشروطها.</p>
        </div>
      </div>

      <div className="mt-8 max-w-4xl mx-auto px-6">
        <Link to="/login" className="text-sm text-[#0a66c2] hover:underline">العودة لتسجيل الدخول</Link>
      </div>

      {!cookieConsent && showCookieModal && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-3xl px-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 flex items-center gap-4 text-right">
            <div className="flex items-center">
              <input
                id="cookie-consent-checkbox"
                type="checkbox"
                checked={cookieConsent}
                onChange={(e) => {
                  if (e.target.checked) acceptCookies();
                }}
                className="w-5 h-5 text-[#0a66c2] rounded focus:ring-0"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-tight">
                نستخدم الكوكيز لحفظ الجلسة وتأمين تسجيل الدخول وتخزين تفضيلاتك. للموافقة على الدخول، ضع علامة (✓) بالمربع.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={acceptCookies}
                className="px-3 py-1.5 rounded-full bg-[#0a66c2] text-white text-sm"
              >
                أوافق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
