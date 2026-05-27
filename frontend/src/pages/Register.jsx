import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

function fmtErr(d) {
  if (!d) return 'Something went wrong';
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return d.map((e) => e?.msg || JSON.stringify(e)).join(' ');
  return d?.msg || JSON.stringify(d);
}

export default function Register() {
  const { register, user, authReady } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headline, setHeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  if (authReady && user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const result = await register({ name, email, password, headline });
      toast.success('تم إنشاء الحساب! يرجى تأكيد بريدك الإلكتروني.');
      const nextUid = result?.user?.id || '';
      navigate(nextUid ? `/verify-email?uid=${encodeURIComponent(nextUid)}` : '/verify-email');
    } catch (e) {
      setErr(fmtErr(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 px-4 bg-[#f4f2ee]">
      <Link to="/" className="flex items-center gap-3 mb-8" data-testid="register-logo">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain" />
        <span className="text-[#0a66c2] font-bold text-4xl tracking-tight">SyrLink</span>
      </Link>
      <div className="li-card w-full max-w-md p-7 shadow-sm">
        <h1 className="text-2xl font-bold mb-1">Join SyrLink</h1>
        <p className="text-sm text-gray-600 mb-5">Make the most of your professional life.</p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label htmlFor="register-name-input" className="text-xs font-semibold text-gray-700">Full name</label>
            <input
              id="register-name-input"
              required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              data-testid="register-name-input"
            />
          </div>
          <div>
            <label htmlFor="register-email-input" className="text-xs font-semibold text-gray-700">Email</label>
            <input
              id="register-email-input"
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              data-testid="register-email-input"
            />
          </div>
          <div>
            <label htmlFor="register-password-input" className="text-xs font-semibold text-gray-700">Password (6+ characters)</label>
            <input
              id="register-password-input"
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              data-testid="register-password-input"
            />
          </div>
          <div>
            <label htmlFor="register-headline-input" className="text-xs font-semibold text-gray-700">Headline (optional)</label>
            <input
              id="register-headline-input"
              value={headline} onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Software Engineer at SyrTech"
              className="w-full mt-1 border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/30"
              data-testid="register-headline-input"
            />
          </div>
          {err && <p className="text-sm text-red-600" data-testid="register-error">{err}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2.5 text-sm"
            data-testid="register-submit"
          >
            {loading ? 'Creating account…' : 'Agree & Join'}
          </button>
          <p className="text-sm text-gray-600 mt-3">
            إذا لم يصلك رابط التحقق بعد التسجيل، يمكنك الانتقال إلى{' '}
            <Link to={`/verify-email?email=${encodeURIComponent(email)}`} className="text-[#0a66c2] hover:underline">
              صفحة التحقق
            </Link>
            .
          </p>
        </form>
        <p className="text-center text-sm mt-5">
          Already on SyrLink?{' '}
          <Link to="/login" className="text-[#0a66c2] font-semibold hover:underline" data-testid="register-to-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
