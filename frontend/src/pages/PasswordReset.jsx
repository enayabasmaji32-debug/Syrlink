import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { toast } from 'sonner';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) { toast.error('Could not send'); }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 px-4 bg-[#f4f2ee]">
      <Link to="/" className="flex items-center gap-3 mb-8">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain" />
        <span className="text-[#0a66c2] font-bold text-4xl">SyrLink</span>
      </Link>
      <div className="li-card w-full max-w-md p-7">
        <h1 className="text-2xl font-bold">Reset your password</h1>
        {sent ? (
          <p className="text-sm text-green-700 mt-3" data-testid="forgot-sent">
            If an account exists with that email, we sent reset instructions. Please check your inbox.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3 mt-3">
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Your account email" data-testid="forgot-email"
              className="w-full border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2]" />
            <button type="submit" data-testid="forgot-submit"
              className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-2.5 text-sm">
              Send reset link
            </button>
          </form>
        )}
        <Link to="/login" className="text-sm text-[#0a66c2] mt-4 inline-block hover:underline">← Back to sign in</Link>
      </div>
    </div>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await client.post('/auth/reset-password', {
        user_id: params.get('uid'),
        token: params.get('token'),
        new_password: pw,
      });
      toast.success('Password reset. Sign in now.');
      navigate('/login');
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-10 px-4 bg-[#f4f2ee]">
      <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 mb-6" />
      <div className="li-card w-full max-w-md p-7">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <form onSubmit={submit} className="space-y-3 mt-3">
          <input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
            placeholder="New password (6+ chars)" data-testid="reset-password-input"
            className="w-full border border-gray-400 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#0a66c2]" />
          <button type="submit" disabled={loading} data-testid="reset-password-submit"
            className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2.5 text-sm">
            {loading ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
