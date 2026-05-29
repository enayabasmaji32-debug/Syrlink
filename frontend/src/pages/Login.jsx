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
    setErr('ظٹط±ط¬ظ‰ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„ظƒظˆظƒظٹط² ظ„ظ„ط¯ط®ظˆظ„');
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

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGitHubLogin}
            disabled={loading || !cookieConsent}
            className="w-full inline-flex items-center justify-center gap-3 bg-black hover:bg-slate-900 disabled:bg-gray-300 text-white font-semibold rounded-2xl py-3 px-5 text-sm shadow-[0_24px_44px_-20px_rgba(0,0,0,0.7)] transition duration-200 ease-out transform hover:-translate-y-0.5 disabled:translate-y-0"
            data-testid="login-submit"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 bg-white rounded-full">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5 text-black" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.54 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.13 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.11.16 1.93.08 2.13.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38C13.71 14.54 16 11.54 16 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </span>
            <span>{loading ? 'Redirecting…' : 'GitHub'}</span>
          </button>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || !cookieConsent}
            className="w-full inline-flex items-center justify-center gap-3 border border-gray-200 bg-white hover:bg-gray-50 disabled:bg-gray-100 text-gray-900 font-semibold rounded-2xl py-3 px-5 text-sm shadow-[0_24px_44px_-20px_rgba(0,0,0,0.16)] transition duration-200 ease-out transform hover:-translate-y-0.5 disabled:translate-y-0"
          >
            <span className="inline-flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-sm">
              <svg viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5">
                <path d="M533.5 278.4c0-17.4-1.5-34.1-4.3-50.4H272v95.4h146.9c-6.4 34.5-25.7 63.7-54.7 83.3v69.2h88.4c51.5-47.5 81.9-117.3 81.9-197.5z" fill="#4285f4"/>
                <path d="M272 544.3c73.7 0 135.7-24.5 181-66.6l-88.4-69.2c-24.5 16.4-56 26-92.6 26-71 0-131.3-47.9-152.9-112.1H32.8v70.4C77.5 487.9 168.4 544.3 272 544.3z" fill="#34a853"/>
                <path d="M88.3 318.9c-11.4-34.1-11.4-70.5 0-104.6V144.1H32.8c-37.2 74.5-37.2 162.8 0 237.3l55.5-62.5z" fill="#fbbc04"/>
                <path d="M272 107.7c39.6-.6 78.4 14.3 108.2 41.4l81.1-81.1C397.1 24.3 337.9-.5 272 0 168.4 0 77.5 56.4 32.8 144.1l55.5 62.5C140.7 150.8 202.1 107.9 272 107.7z" fill="#ea4335"/>
              </svg>
            </span>
            <span>{loading ? 'Redirecting…' : 'Google'}</span>
          </button>
        </div>

        <div className="mt-6 text-sm text-gray-600">
          <p>
            بتسجيل الدخول أنت توافق على <a href="/terms" className="text-[#0a66c2] hover:underline" target="_blank" rel="noopener noreferrer">الشروط</a> و
            <a href="/privacy" className="text-[#0a66c2] hover:underline mx-1" target="_blank" rel="noopener noreferrer">سياسة الخصوصية</a> و
            <a href="/nda" className="text-[#0a66c2] hover:underline" target="_blank" rel="noopener noreferrer">اتفاقية عدم الإفشاء (NDA)</a>.
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
                aria-label="ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„ظƒظˆظƒظٹط²"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-200 leading-tight">
                ظ†ط³طھط®ط¯ظ… ط§ظ„ظƒظˆظƒظٹط² ظ„ط­ظپط¸ ط§ظ„ط¬ظ„ط³ط© ظˆطھط£ظ…ظٹظ† طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ظˆطھط®ط²ظٹظ† طھظپط¶ظٹظ„ط§طھظƒ. ظ„ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„ط¯ط®ظˆظ„طŒ ط¶ط¹ ط¹ظ„ط§ظ…ط© (âœ“) ط¨ط§ظ„ظ…ط±ط¨ط¹.
                ط¨ظپطھط­ ط§ظ„ط±ظˆط§ط¨ط·طŒ ط§ط·ظ„ط¹ ط¹ظ„ظ‰ {' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">ط´ط±ظˆط· ط§ظ„ط§ط³طھط®ط¯ط§ظ…</a>, {' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">ط³ظٹط§ط³ط© ط§ظ„ط®طµظˆطµظٹط©</a> ظˆ {' '}
                <a href="/nda" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">ط§طھظپط§ظ‚ظٹط© ط¹ط¯ظ… ط§ظ„ط¥ظپطµط§ط­ (NDA)</a>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { declineCookies(); setShowCookieModal(false); }}
                className="px-3 py-1.5 rounded-full border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
              >
                ظ„ط§ ط£ظˆط§ظپظ‚
              </button>
              <button
                type="button"
                onClick={acceptCookies}
                disabled={cookieConsent}
                className="px-3 py-1.5 rounded-full bg-[#0a66c2] text-white text-sm disabled:opacity-60"
              >
                ط£ظˆط§ظپظ‚
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


