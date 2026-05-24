import React, { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { authApi } from '../api';
import { toast } from 'sonner';

function fmtErr(d) {
  if (!d) return 'Something went wrong';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(' ');
  return d?.msg || JSON.stringify(d);
}

export default function Login() {
  const { login, user, authReady } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('demo@syrlink.com');
  const [password, setPassword] = useState('demo1234');
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

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!cookieConsent) {
      setErr('يرجى الموافقة على الكوكيز للدخول');
      setShowCookieModal(true);
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (e) {
      setErr(fmtErr(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 px-4 bg-[#f4f2ee]">
      <Link to="/" className="flex items-center gap-3 mb-8" data-testid="login-logo">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain" />
        <span className="text-[#0a66c2] font-bold text-4xl tracking-tight">SyrLink</span>
      </Link>
      <div className="li-card w-full max-w-md p-7 shadow-sm">
        <h1 className="text-2xl font-bold mb-1">Sign in</h1>
        <p className="text-sm text-gray-600 mb-5">Stay connected with your professional world.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="login-email" className="text-xs font-semibold text-gray-700">Email</label>
            <input
              id="login-email"
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              data-testid="login-email-input"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-xs font-semibold text-gray-700">Password</label>
            <input
              id="login-password"
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              data-testid="login-password-input"
            />
          </div>
          {err && <p className="text-sm text-red-600" data-testid="login-error">{err}</p>}
          {!cookieConsent && (
            <p className="text-sm text-gray-500">يجب الموافقة على الكوكيز قبل تسجيل الدخول.</p>
          )}
          <button
            type="submit" disabled={loading || !cookieConsent}
            className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2.5 text-sm"
            data-testid="login-submit"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <a
            href={cookieConsent ? authApi.googleLoginUrl() : '#'}
            onClick={(e) => {
              if (!cookieConsent) {
                e.preventDefault();
                setErr('يرجى الموافقة على الكوكيز قبل تسجيل الدخول');
                setShowCookieModal(true);
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 mt-3 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-full py-2 text-sm"
            rel="noopener noreferrer"
          >
            Continue with Google
          </a>
        </form>
        <div className="flex items-center my-5 text-xs text-gray-500">
          <div className="flex-1 border-t border-gray-300" />
          <span className="mx-2">or</span>
          <div className="flex-1 border-t border-gray-300" />
        </div>
        <div className="text-center">
          <Link to="/forgot-password" className="text-sm text-[#0a66c2] hover:underline" data-testid="login-forgot-link">Forgot password?</Link>
        </div>
        <p className="text-center text-sm">
          New to SyrLink?{' '}
          <Link to="/register" className="text-[#0a66c2] font-semibold hover:underline" data-testid="login-to-register">
            Join now
          </Link>
        </p>
        <div className="mt-3 text-center text-sm">
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline ml-3">شروط الاستخدام</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline ml-3">سياسة الخصوصية</a>
          <a href="/nda" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">اتفاقية عدم الإفصاح (NDA)</a>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-4">Demo: demo@syrlink.com / demo1234</p>
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
                بفتح الروابط، اطلع على
                {' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">شروط الاستخدام</a>
                ,
                {' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">سياسة الخصوصية</a>
                {' '}و
                {' '}
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
