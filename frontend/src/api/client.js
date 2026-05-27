import axios from 'axios';

const rawBaseURL = process.env.REACT_APP_BACKEND_URL?.trim() || '';
const normalizedBaseURL = rawBaseURL === '/' ? '' : rawBaseURL.replace(/\/$/, '');
const baseURL = `${normalizedBaseURL}/api`;

const client = axios.create({ 
  baseURL,
  timeout: 30000, // 30 seconds timeout for normal operations
  withCredentials: true,
});

// Retry configuration with request-level tracking
const MAX_RETRIES = 2;
const RETRY_CONFIG = new WeakMap();
const NON_RETRYABLE_ENDPOINTS = ['/auth/register', '/auth/login', '/auth/verify-otp'];

const getRetryKey = (config) => {
  return `${config.method}-${config.url}`;
};

const shouldRetry = (config) => {
  // Don't retry auth endpoints (they may have side effects)
  return !NON_RETRYABLE_ENDPOINTS.some((ep) => config.url?.includes(ep));
};

const logNetworkError = (err) => {
  if (err.response == null) {
    if (err.code === 'ECONNABORTED') {
      console.error('[API] Request timeout - server took too long to respond');
    } else if (err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
      console.error('[API] Network error:', err);
    } else {
      console.error('[API] Network error:', err.message, err.code);
    }
  } else {
    console.error('[API] HTTP error:', err.response.status, err.response.data);
  }
};

const redirectToLoginIfNeeded = () => {
  if (typeof globalThis !== 'undefined' && globalThis.location) {
    const allowedPaths = ['/login', '/register', '/verify-otp', '/forgot-password'];
    if (!allowedPaths.includes(globalThis.location.pathname)) {
      try {
        globalThis.location.assign('/login');
      } catch (redirectError) {
        console.warn('[API] Login redirect skipped in non-browser env', redirectError);
      }
    }
  }
};

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('li_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Initialize retry counter for this specific request
  if (!config.retryCount) {
    config.retryCount = 0;
  }
  return config;
});

client.interceptors.response.use(
  (r) => {
    // Clear retry count on success
    r.config.retryCount = 0;
    return r;
  },
  async (err) => {
    // Log network errors for debugging
    logNetworkError(err);

    // Only retry for gateway/service unavailable errors on idempotent endpoints
    if (
      shouldRetry(err.config) &&
      (err?.response?.status === 502 || err?.response?.status === 503) &&
      (!err.config.retryCount || err.config.retryCount < MAX_RETRIES)
    ) {
      err.config.retryCount = (err.config.retryCount || 0) + 1;
      console.warn(
        `[API] Server unavailable (${err.response?.status}), retrying (attempt ${err.config.retryCount}/${MAX_RETRIES})`
      );

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * err.config.retryCount));
      return client.request(err.config);
    }

    if (err?.response?.status === 401) {
      localStorage.removeItem('li_token');
      redirectToLoginIfNeeded();
    }

    throw err;
  }
);

export default client;
