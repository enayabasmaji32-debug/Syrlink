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

export default function PrivacyPolicy() {
  const published = '20 مايو 2026';
  const updated = '20 مايو 2026';
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

      <div className="max-w-4xl mx-auto p-6 sm:p-10">
        <div className="rounded-lg bg-white shadow-sm border p-5">
          <h1 className="text-2xl font-bold">سياسة الخصوصية - منصة SyrLink</h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
            <span className="px-2 py-1 bg-gray-100 rounded">تاريخ النشر: {published}</span>
            <span className="px-2 py-1 bg-gray-100 rounded">آخر تحديث: {updated}</span>
          </div>
        </div>
      </div>

      <div className="prose prose-invert max-w-none leading-relaxed text-right max-w-4xl mx-auto p-6" dir="rtl">
        <h2>سياسة الخصوصية</h2>
        <p>آخر تحديث: 20 مايو 2026</p>
        <p>
          تشكل هذه السياسة جزءاً من اتفاق استخدام منصة SyrLink، ويُعدّ إنشاء حساب أو الدخول إلى المنصة أو استخدامها
          بأي شكل إقراراً منك بأنك قرأت هذه السياسة وفهمتها ووافقت على الالتزام بأحكامها.
        </p>
        <p>منصة SyrLink توفر بيئة احترافية للتواصل والعمل. حماية بيانات المستخدمين والخصوصية من أولويات المنصة.</p>
        <p className="mt-6">باستخدامك لمنصة SyrLink، فإنك تقر بأنك قرأت وفهمت سياسة الخصوصية هذه، وتوافق على الالتزام بأحكامها بوصفها جزءاً لا يتجزأ من اتفاق استخدام المنصة.</p>
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
