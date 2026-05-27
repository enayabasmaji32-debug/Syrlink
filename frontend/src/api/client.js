import axios from 'axios';

const rawBaseURL = process.env.REACT_APP_BACKEND_URL?.trim() || '';
const normalizedBaseURL = rawBaseURL === '/' ? '' : rawBaseURL.replace(/\/$/, '');
const baseURL = `${normalizedBaseURL}/api`;

const client = axios.create({ 
  baseURL,
  timeout: 300000, // 5 minutes timeout for heavy operations
  withCredentials: true,
});

// Retry configuration with request-level tracking
const MAX_RETRIES = 3;
const RETRY_CONFIG = new WeakMap();

const getRetryKey = (config) => {
  return `${config.method}-${config.url}`;
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
    if (!err.response) {
      if (err.code === 'ECONNABORTED') {
        console.error('[API] Request timeout - server took too long to respond');
      } else if (err.message === 'Network Error') {
        console.error('[API] Network error:', err);
      } else {
        console.error('[API] Network error:', err.message, err.code);
      }
    } else {
      console.error('[API] HTTP error:', err.response.status, err.response.data);
    }
    
    // If 502/503 (gateway/service unavailable), retry
    if ((err?.response?.status === 502 || err?.response?.status === 503) && 
        (!err.config.retryCount || err.config.retryCount < MAX_RETRIES)) {
      err.config.retryCount = (err.config.retryCount || 0) + 1;
      console.warn(`[API] Server unavailable (${err.response.status}), retrying (attempt ${err.config.retryCount}/${MAX_RETRIES})`);
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * err.config.retryCount));
      return client.request(err.config);
    }
    
    if (err?.response?.status === 401) {
      localStorage.removeItem('li_token');
      // Redirect to login if not already there (only on protected routes)
      if (typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
        window.location.assign('/login');
      }
    }
    
    // Retry logic for timeout errors
    if (err.code === 'ECONNABORTED' && (!err.config.retryCount || err.config.retryCount < MAX_RETRIES)) {
      err.config.retryCount = (err.config.retryCount || 0) + 1;
      console.warn(`[API] Retrying timeout request (attempt ${err.config.retryCount}/${MAX_RETRIES})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * err.config.retryCount));
      return client.request(err.config);
    }
    
    return Promise.reject(err);
  }
);

export default client;
