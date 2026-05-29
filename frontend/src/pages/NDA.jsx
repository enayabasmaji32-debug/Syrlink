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
          <p className="text-sm text-gray-600 mt-2">آخر تحديث: 20 مايو 2026</p>
        </div>

        <div className="prose prose-invert max-w-none leading-relaxed">
          <h2>اتفاقية عدم الإفصاح (NDA)</h2>
          <p>
            تشكل هذه اتفاقية عدم الإفصاح والسرية جزءاً لا يتجزأ من شروط الاستخدام والسياسة القانونية العامة الخاصة بمنصة SyrLink.
          </p>
          <p>
            يُعد استخدام أي شخص أو جهة للمنصة، بأي صورة كانت، بما في ذلك الدخول أو التصفح أو إنشاء حساب أو استخدام أي من الخدمات أو الميزات المتاحة عبر المنصة، قبولاً صريحاً ونهائياً بأحكام هذه الاتفاقية.
          </p>
          <p>
            منصة SyrLink تحترم سرية المعلومات والبيانات الخاصة بمستخدميها والشركات والجهات المتفاعلة معها.
          </p>
          <p className="mt-6">
            باستخدامك لمنصة SyrLink، فإنك تقر بأنك قد قرأت هذه اتفاقية عدم الإفصاح (NDA) وفهمت مضمونها، وتوافق على الالتزام التام بجميع أحكامها وشروطها.
          </p>
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
