import { Config } from '@netlify/functions';

const BACKEND_URL = 'https://syrlink.onrender.com';

export default async (req) => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/me`, {
      signal: AbortSignal.timeout(25000),
    });
    console.log(`Keep-warm ping: ${res.status}`);
  } catch (err) {
    console.log(`Keep-warm ping failed (server may be waking up): ${err.message}`);
  }
}

export const config = {
  schedule: '*/10 * * * *',
};
