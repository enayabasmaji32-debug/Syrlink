import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';

/**
 * صفحة التحقق من OTP
 * 
 * الخطوات:
 * 1. المستخدم يدخل رمز 6 أرقام
 * 2. يتم إرسال الرمز والإيميل للـ API
 * 3. إذا صحيح → البريد يصبح مفعّل → توجيه للـ Login
 * 4. إذا خاطئ → رسالة خطأ + خيار طلب رمز جديد
 */
export default function VerifyOtp() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  
  // ========== States ==========
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  
  // رسائل و أخطاء
  const { setUser } = useApp();
  const [message, setMessage] = useState('');      // "Email already verified"
  const [error, setError] = useState('');           // خطأ عام
  const [successMsg, setSuccessMsg] = useState('');  // "Successfully verified"
  
  // Countdown timer لزر "Resend"
  const [countdown, setCountdown] = useState(0);

  // ========== On Mount: تحديد الإيميل من URL ==========
  useEffect(() => {
    const queryEmail = params.get('email');
    if (queryEmail) {
      setEmail(queryEmail);
      console.log('[VerifyOtp] 📧 Email from URL:', queryEmail);
    } else {
      setError('❌ Email not provided. Please go back to register.');
    }
  }, [params]);

  // ========== Countdown Timer for Resend Button ==========
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // ========== التحقق من الرمز ==========
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    // التحقق من البريد
    if (!email || !email.trim()) {
      setError('❌ Email is not defined. Please go back to register.');
      console.error('[VerifyOtp] Email is empty');
      return;
    }
    
    // التحقق من صيغة الرمز (يجب 6 أرقام بالضبط)
    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError('❌ Code must be exactly 6 digits.');
      console.error('[VerifyOtp] Invalid OTP format:', otp);
      return;
    }

    console.log('[VerifyOtp] 🔐 Verifying OTP for:', email);
    setVerifying(true);
    
    try {
      // استدعاء API
      const result = await authApi.verifyOtp({ email, otp });
      console.log('[VerifyOtp] ✅ Verification successful:', result);
      
      if (result.ok) {
        toast.success('✓ Email verified successfully!');
        setSuccessMsg('✓ Your email has been verified! Redirecting to your dashboard...');
        
        if (result.token) {
          localStorage.setItem('li_token', result.token);
          setUser(result.user);
        }

        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      } else {
        setError(result.message || '❌ Verification failed. Check the code and try again.');
      }
    } catch (e) {
      console.error('[VerifyOtp] ❌ Error:', e);
      
      let errorMsg = '❌ Verification failed. Check the code and try again.';
      
      // معالجة الأخطاء المختلفة
      if (e?.response?.status === 401) {
        errorMsg = '❌ Invalid or expired code. Request a new one.';
      } else if (e?.response?.status === 404) {
        errorMsg = '❌ Email not found. Please register again.';
      } else if (e?.response?.status === 500) {
        errorMsg = '❌ Server error. Please try again later.';
      } else if (!e?.response) {
        errorMsg = '❌ Network error. Check your internet connection.';
      } else {
        errorMsg = e.response?.data?.detail || errorMsg;
      }
      
      setError(errorMsg);
    } finally {
      setVerifying(false);
    }
  };

  // ========== طلب رمز جديد ==========
  const handleResendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!email || !email.trim()) {
      setError('❌ Email is not defined.');
      return;
    }
    
    console.log('[VerifyOtp] 📨 Resending OTP for:', email);
    setResending(true);
    setCountdown(60); // 60 ثانية انتظار
    
    try {
      const result = await authApi.resendOtp({ email });
      console.log('[VerifyOtp] ✅ Resend response:', result);
      
      // الحالة 1: البريد مفعّل بالفعل
      if (result.already_verified) {
        setMessage('✓ Your email is already verified! You can now login.');
        setTimeout(() => {
          navigate('/login', { state: { email } });
        }, 2000);
      } 
      // الحالة 2: تم إرسال رمز جديد
      else {
        toast.success('✓ New code sent to your email!');
        setSuccessMsg('✓ A new verification code has been sent to your email.');
        setOtp(''); // مسح الحقل
      }
    } catch (e) {
      console.error('[VerifyOtp] ❌ Resend error:', e);
      let errorMsg = '❌ Failed to send code. Try again later.';
      
      if (e?.response?.status === 404) {
        errorMsg = '❌ Email not found.';
      } else if (e?.response?.data?.detail) {
        errorMsg = e.response.data.detail;
      }
      
      setError(errorMsg);
      setCountdown(0); // إعادة تعيين العد التنازلي عند الخطأ
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f2ee] p-4">
      <div className="li-card p-8 max-w-md w-full" data-testid="verify-otp-card">
        {/* الرأس */}
        <div className="text-center mb-6">
          <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Verify Email</h1>
          <p className="text-sm text-gray-600">
            Enter the code sent to <strong>{email}</strong>
          </p>
        </div>

        {/* رسالة النجاح */}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 font-semibold">{successMsg}</p>
          </div>
        )}

        {/* رسالة البريد المفعّل مسبقاً */}
        {message && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 font-semibold">{message}</p>
            <Link to="/login" className="text-sm text-[#0a66c2] hover:underline font-semibold mt-2 block">
              Go to Login
            </Link>
          </div>
        )}

        {/* رسالة الخطأ */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* النموذج الرئيسي - يظهر ما لم يكن البريد مفعّل بالفعل */}
        {!message && (
          <>
            {/* نموذج التحقق من الرمز */}
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="otp-input" className="text-xs font-semibold text-gray-700 block text-left mb-2">
                  Verification Code (6 digits)
                </label>
                <input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => {
                    // السماح فقط بالأرقام
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                  }}
                  placeholder="000000"
                  className="w-full border border-gray-400 rounded-lg px-3 py-2 text-lg text-center font-mono tracking-widest focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
                  disabled={verifying || !!successMsg}
                  autoFocus
                />
              </div>

              {/* زر التحقق */}
              <button
                type="submit"
                disabled={verifying || !otp || otp.length !== 6}
                className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-full py-2.5 text-sm transition"
              >
                {verifying ? 'Verifying...' : 'Verify Code'}
              </button>
            </form>

            {/* فاصل */}
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 border-t border-gray-300"></div>
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            {/* زر طلب رمز جديد */}
            <form onSubmit={handleResendOtp}>
              <button
                type="submit"
                disabled={resending || countdown > 0}
                className="w-full border-2 border-[#0a66c2] hover:bg-[#0a66c2]/10 disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed text-[#0a66c2] font-semibold rounded-full py-2.5 text-sm transition"
              >
                {resending ? 'Sending...' : countdown > 0 ? `Resend Code (${countdown}s)` : 'Send New Code'}
              </button>
            </form>

            {/* رابط العودة */}
            <p className="text-center text-sm text-gray-600 mt-4">
              Didn't receive the code?{' '}
              <Link to="/register" className="text-[#0a66c2] hover:underline font-semibold">
                Go back to register
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
