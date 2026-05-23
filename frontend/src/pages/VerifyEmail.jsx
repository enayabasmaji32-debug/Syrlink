import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import client from '../api/client';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, ok: false, msg: '' });

  useEffect(() => {
    const token = params.get('token');
    const uid = params.get('uid');
    if (!token || !uid) { setState({ loading: false, ok: false, msg: 'Missing token' }); return; }
    client.post('/auth/verify-email', { user_id: uid, token })
      .then(() => setState({ loading: false, ok: true, msg: 'Your email is verified ✓' }))
      .catch((e) => setState({ loading: false, ok: false, msg: e.response?.data?.detail || 'Verification failed' }));
  }, [params]);

  return (
    <div className="min-h-screen grid place-items-center bg-[#f4f2ee] p-4">
      <div className="li-card p-8 max-w-md text-center" data-testid="verify-email-card">
        <img src="/syrlink-logo.png" alt="SyrLink" className="w-14 h-14 object-contain mx-auto mb-3" />
        {state.loading && <p className="text-sm text-gray-600">Verifying…</p>}
        {!state.loading && (
          <>
            <h1 className={`text-2xl font-bold ${state.ok ? 'text-green-600' : 'text-red-600'}`}>{state.ok ? 'Email verified!' : 'Could not verify'}</h1>
            <p className="text-sm text-gray-600 mt-2">{state.msg}</p>
            <Link to="/" className="inline-block mt-4 bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full px-5 py-2 text-sm">Continue to SyrLink →</Link>
          </>
        )}
      </div>
    </div>
  );
}
