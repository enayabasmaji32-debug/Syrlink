import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api';

export default function VerifyOtp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const queryEmail = params.get('email');
    if (queryEmail) {
      setEmail(queryEmail);
    }
  }, [params]);

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!otp || otp.length !== 6) {
      setError('يجب أن يكون الرمز 6 أرقام.');
      return;
    }

    setVerifying(true);
    try {
      await authApi.verifyOtp({ email, otp });
      setSuccessMsg('✓ تم التحقق من بريدك الإلكتروني بنجاح! جاري تسجيل الدخول...');
      setTimeout(() => {
        navigate('/login', { state: { email, autoVerified: true } });
      }, 1500);
    } catch (e) {
      setError(e.response?.data?.detail || 'فشل التحقق. تأكد من الرمز وحاول مرة أخرى.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setResending(true);
    
    try {
      const result = await authApi.resendOtp({ email });
      if (result.already_verified) {
        setMessage('✓ بريدك الإلكتروني مفعّل بالفعل. يمكنك الآن تسجيل الدخول.');
        setTimeout(() => {
          navigate('/login', { state: { email } });
        }, 2000);
      } else {
        setSuccessMsg('✓ تم إرسال رمز جديد إلى بريدك الإلكتروني.');
        setOtp('');
      }
    } catch (e) {
      setError(e.response?.data?.detail || 'فشل إرسال الرمز. حاول لاحقاً.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f2ee] p-4">
      <div className="li-card p-8 max-w-md w-full text-center" data-testid="verify-otp-card">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain mx-auto mb-3" />
        <h1 className="text-2xl font-bold mb-2">التحقق من بريدك</h1>
        <p className="text-sm text-gray-600 mb-5">أدخل الرمز المرسل إلى <strong>{email}</strong></p>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
            <p className="text-sm text-green-700">{successMsg}</p>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label htmlFor="otp-input" className="text-xs font-semibold text-gray-700 block text-left">
              رمز التحقق (6 أرقام)
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              maxLength="6"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setOtp(val);
              }}
              placeholder="000000"
              className="w-full mt-2 border border-gray-400 rounded px-3 py-2 text-sm text-center font-mono tracking-widest focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              disabled={verifying}
            />
          </div>

          <button
            type="submit"
            disabled={verifying || otp.length !== 6}
            className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2.5 text-sm transition"
          >
            {verifying ? 'جاري التحقق...' : 'تأكيد الرمز'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-300">
          <p className="text-sm text-gray-600 mb-3">لم يصل الرمز؟</p>
          <button
            onClick={handleResendOtp}
            disabled={resending}
            className="text-sm text-[#0a66c2] hover:underline font-semibold disabled:text-gray-400"
          >
            {resending ? 'جاري الإرسال...' : 'إعادة إرسال الرمز'}
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-300 text-center">
          <p className="text-sm text-gray-600">
            هل تريد تغيير البريد؟{' '}
            <Link to="/register" className="text-[#0a66c2] hover:underline font-semibold">
              العودة للتسجيل
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

