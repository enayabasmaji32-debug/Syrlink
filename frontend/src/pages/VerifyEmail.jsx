import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { authApi } from '../api';
import { sendVerificationEmail } from '../services/emailService';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [uid, setUid] = useState(params.get('uid') || '');
  const [token, setToken] = useState(params.get('token') || '');
  const [email, setEmail] = useState(params.get('email') || '');
  const hasQueryParams = !!(params.get('uid') && params.get('token'));
  const [state, setState] = useState({ loading: hasQueryParams, ok: null, msg: '' });

  const verify = async (user_id, tokenValue) => {
    setState({ loading: true, ok: null, msg: '' });
    try {
      await authApi.verifyEmail({ user_id, token: tokenValue });
      setState({ loading: false, ok: true, msg: 'تم تأكيد بريدك الإلكتروني بنجاح.' });
    } catch (e) {
      setState({
        loading: false,
        ok: false,
        msg: e.response?.data?.detail || 'فشل التحقق، يرجى التحقق من الرمز والمحاولة مرة أخرى.',
      });
    }
  };

  const resend = async (event) => {
    event.preventDefault();
    setState({ loading: true, ok: null, msg: '' });
    if (!email) {
      setState({
        loading: false,
        ok: false,
        msg: 'يرجى إدخال بريدك الإلكتروني.',
      });
      return;
    }
    try {
      // Generate a random 6-digit code for verification
      const passcode = Math.floor(100000 + Math.random() * 900000).toString();
      await sendVerificationEmail(email, passcode);
      setState({
        loading: false,
        ok: true,
        msg: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني. تحقق من صندوق الرسائل.',
      });
    } catch (e) {
      setState({
        loading: false,
        ok: false,
        msg: e.message || 'فشل إرسال رمز التحقق. حاول لاحقاً.',
      });
    }
  };

  useEffect(() => {
    const queryToken = params.get('token');
    const queryUid = params.get('uid');
    const queryEmail = params.get('email');
    if (queryEmail) {
      setEmail(queryEmail);
    }
    if (queryUid && queryToken) {
      setUid(queryUid);
      setToken(queryToken);
      verify(queryUid, queryToken);
    } else {
      setState({ loading: false, ok: null, msg: 'أدخل بريدك الإلكتروني لاستلام رمز التحقق.' });
    }
  }, [params]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setState({ loading: true, ok: null, msg: '' });
    await verify(uid, token);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f2ee] p-4">
      <div className="li-card p-8 max-w-md w-full text-center" data-testid="verify-email-card">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-3">تأكيد البريد الإلكتروني</h1>
        {state.loading && <p className="text-sm text-gray-600">جارٍ التحقق...</p>}

        {!state.loading && state.ok === true && (
          <>
            <p className="text-sm text-green-600">{state.msg}</p>
            <Link to="/login" className="inline-block mt-5 bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full px-5 py-2 text-sm">العودة لتسجيل الدخول</Link>
          </>
        )}

        {!state.loading && state.ok === false && (
          <>
            <p className="text-sm text-red-600">{state.msg}</p>
            <form onSubmit={resend} className="mt-6 space-y-4 text-left">
              <div>
                <label htmlFor="resend-email-input" className="text-xs font-semibold text-gray-700">البريد الإلكتروني</label>
                <input
                  id="resend-email-input"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-2.5 text-sm"
              >
                إعادة إرسال رمز التحقق
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-4">يمكنك استخدام نفس البريد الذي استخدمته عند التسجيل.</p>
          </>
        )}

        {!state.loading && state.ok === null && hasQueryParams && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <p className="text-sm text-gray-600">{state.msg}</p>
            </div>
            <div>
              <label htmlFor="verify-uid-input" className="text-xs font-semibold text-gray-700">رقم المستخدم (UID)</label>
              <input
                id="verify-uid-input"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
                placeholder="أدخل UID"
              />
            </div>
            <div>
              <label htmlFor="verify-token-input" className="text-xs font-semibold text-gray-700">رمز التحقق</label>
              <input
                id="verify-token-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
                placeholder="أدخل رمز التحقق"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-2.5 text-sm"
            >
              تحقق الآن
            </button>
          </form>
        )}

        {!state.loading && state.ok === null && !hasQueryParams && (
          <form onSubmit={resend} className="space-y-4 text-left">
            <div>
              <p className="text-sm text-gray-600">{state.msg}</p>
            </div>
            <div>
              <label htmlFor="verify-email-input" className="text-xs font-semibold text-gray-700">البريد الإلكتروني</label>
              <input
                id="verify-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-2.5 text-sm"
            >
              إرسال رمز التحقق
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
