import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api';

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [state, setState] = useState({ loading: false, ok: null, msg: '' });

  useEffect(() => {
    const queryEmail = params.get('email');
    if (queryEmail) {
      setEmail(queryEmail);
    } else if (!email) {
      setState({
        loading: false,
        ok: false,
        msg: 'يرجى العودة من صفحة التسجيل لتلقي رمز التحقق.',
      });
    }
  }, [params, email]);

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (!otp || otp.length !== 6) {
      setState({
        loading: false,
        ok: false,
        msg: 'يجب أن يكون الرمز 6 أرقام.',
      });
      return;
    }

    setState({ loading: true, ok: null, msg: '' });
    try {
      const result = await authApi.verifyOtp({ email, otp });
      setState({
        loading: false,
        ok: true,
        msg: 'تم التحقق من بريدك الإلكتروني بنجاح! جاري تسجيل الدخول...',
      });
      
      // Store user data and auto-login
      setTimeout(() => {
        navigate('/login', { state: { email, autoVerified: true } });
      }, 1500);
    } catch (e) {
      setState({
        loading: false,
        ok: false,
        msg: e.response?.data?.detail || 'فشل التحقق. تأكد من الرمز وحاول مرة أخرى.',
      });
    }
  };

  const resendOtp = async (event) => {
    event.preventDefault();
    setState({ loading: true, ok: null, msg: '' });
    try {
      await authApi.resendOtp({ email });
      setState({
        loading: false,
        ok: true,
        msg: 'تم إرسال رمز جديد إلى بريدك الإلكتروني.',
      });
    } catch (e) {
      setState({
        loading: false,
        ok: false,
        msg: e.response?.data?.detail || 'فشل إرسال الرمز. حاول لاحقاً.',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f2ee] p-4">
      <div className="li-card p-8 max-w-md w-full text-center" data-testid="verify-otp-card">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-2">التحقق من بريدك</h1>
        <p className="text-sm text-gray-600 mb-5">أدخل الرمز المرسل إلى {email}</p>

        {state.loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-[#0a66c2] rounded-full"></div>
            </div>
            <p className="text-sm text-gray-600 mt-3">جاري المعالجة...</p>
          </div>
        )}

        {!state.loading && state.ok === true && (
          <div className="text-center py-8">
            <div className="text-green-600 mb-3">
              <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm text-green-600 font-semibold">{state.msg}</p>
          </div>
        )}

        {!state.loading && state.ok === false && (
          <>
            <form onSubmit={verifyOtp} className="space-y-4 text-left">
              <div>
                <label htmlFor="otp-input" className="text-xs font-semibold text-gray-700">
                  رمز التحقق (6 أرقام)
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  required
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                  }}
                  placeholder="000000"
                  className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm text-center font-mono tracking-widest focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
                  data-testid="otp-input"
                />
              </div>
              <p className="text-sm text-red-600">{state.msg}</p>
              <button
                type="submit"
                disabled={otp.length !== 6}
                className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2.5 text-sm"
              >
                تأكيد الرمز
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-300">
              <p className="text-sm text-gray-600 mb-3">لم يصل الرمز؟</p>
              <button
                onClick={resendOtp}
                disabled={state.loading}
                className="text-sm text-[#0a66c2] hover:underline font-semibold"
              >
                إعادة إرسال الرمز
              </button>
            </div>
          </>
        )}

        {!state.loading && state.ok === null && (
          <form onSubmit={verifyOtp} className="space-y-4 text-left">
            <div>
              <label htmlFor="otp-input" className="text-xs font-semibold text-gray-700">
                رمز التحقق (6 أرقام)
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                maxLength="6"
                required
                value={otp}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setOtp(val);
                }}
                placeholder="000000"
                className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm text-center font-mono tracking-widest focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
                data-testid="otp-input"
              />
            </div>
            <button
              type="submit"
              disabled={otp.length !== 6}
              className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2.5 text-sm"
            >
              تأكيد الرمز
            </button>
          </form>
        )}

        {!state.loading && (
          <div className="mt-6 pt-6 border-t border-gray-300 text-center">
            <p className="text-sm text-gray-600">
              هل تريد تغيير البريد؟{' '}
              <Link to="/register" className="text-[#0a66c2] hover:underline font-semibold">
                العودة للتسجيل
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
