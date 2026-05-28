import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authApi } from '../api';

export default function Login() {
  const { user, authReady } = useApp();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cookieConsent, setCookieConsent] = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);

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

  useEffect(() => {
    const consent = getCookie('li_cookie_consent') === 'yes';
    setCookieConsent(consent);
    setShowCookieModal(!consent);
  }, []);

  if (authReady && user) return <Navigate to="/" replace />;

  const acceptCookies = () => {
    setCookie('li_cookie_consent', 'yes', { maxAge: 31536000 });
    setCookieConsent(true);
    setShowCookieModal(false);
    setErr('');
  };

  const declineCookies = () => {
    setCookieConsent(false);
    setShowCookieModal(true);
    setErr('يرجى الموافقة على الكوكيز للدخول');
  };

  const handleGitHubLogin = (e) => {
    e.preventDefault();
    setErr('');
    if (!cookieConsent) {
      setErr('يرجى الموافقة على الكوكيز للدخول');
      setShowCookieModal(true);
      return;
    }
    setLoading(true);
    window.location.assign(authApi.githubLoginUrl());
  };

  const handleGoogleLogin = (e) => {
    e.preventDefault();
    setErr('');
    if (!cookieConsent) {
      setErr('يرجى الموافقة على الكوكيز للدخول');
      setShowCookieModal(true);
      return;
    }
    setLoading(true);
    window.location.assign(authApi.googleLoginUrl());
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 px-4 bg-[#f4f2ee]">
      <Link to="/" className="flex items-center gap-3 mb-8" data-testid="login-logo">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain" />
        <span className="text-[#0a66c2] font-bold text-4xl tracking-tight">SyrLink</span>
      </Link>

      <div className="li-card w-full max-w-md p-7 shadow-sm">
        <h1 className="text-2xl font-bold mb-1">Sign in with GitHub or Google</h1>
        <p className="text-sm text-gray-600 mb-5">
          Use GitHub or Google to authenticate and access SyrLink securely.
        </p>

        {err && <p className="text-sm text-red-600 mb-3" data-testid="login-error">{err}</p>}

        <button
          type="button"
          onClick={handleGitHubLogin}
          disabled={loading || !cookieConsent}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-3 text-sm"
          data-testid="login-submit"
        >
          {loading ? 'Redirecting…' : 'Continue with GitHub'}
        </button>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading || !cookieConsent}
          className="w-full inline-flex items-center justify-center gap-2 mt-3 border border-gray-300 bg-white hover:bg-gray-100 disabled:bg-gray-100 text-gray-900 font-semibold rounded-full py-3 text-sm"
        >
          {loading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        {!cookieConsent && (
          <p className="text-sm text-gray-500 mt-3">يجب الموافقة على الكوكيز قبل تسجيل الدخول.</p>
        )}

        <div className="mt-6 text-sm text-gray-600">
          <p>GitHub و Google OAuth هما طرق المصادقة الوحيدة المدعومة.</p>
          <p className="mt-2">
            If you need help, contact the team or review the terms and privacy policy.
          </p>
        </div>
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
                  if (e.target.checked) acceptCookies(); else declineCookies();
                }}
                className="w-5 h-5 text-[#0a66c2] rounded focus:ring-0"
                aria-label="موافقة على الكوكيز"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-tight">
                نستخدم الكوكيز لحفظ الجلسة وتأمين تسجيل الدخول وتخزين تفضيلاتك. للموافقة على الدخول، ضع علامة (✓) بالمربع.
                بفتح الروابط، اطلع على {' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">شروط الاستخدام</a>, {' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">سياسة الخصوصية</a> و {' '}
                <a href="/nda" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">اتفاقية عدم الإفصاح (NDA)</a>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { declineCookies(); setShowCookieModal(false); }}
                className="px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                لا أوافق
              </button>
              <button
                type="button"
                onClick={acceptCookies}
                disabled={cookieConsent}
                className="px-3 py-1.5 rounded-full bg-[#0a66c2] text-white text-sm disabled:opacity-60"
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
