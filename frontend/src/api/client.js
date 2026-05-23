import axios from 'axios';

const baseURL = `${process.env.REACT_APP_BACKEND_URL}/api`;

const getCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
};

const client = axios.create({ 
  baseURL,
  timeout: 300000, // 5 minutes timeout for heavy operations
});

// Retry configuration
const MAX_RETRIES = 3;
let retryCount = {};

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('li_token') || getCookie('li_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (r) => {
    // Clear retry count on success
    retryCount[r.config.url] = 0;
    return r;
  },
  async (err) => {
    // Log network errors for debugging
    if (!err.response) {
      if (err.code === 'ECONNABORTED') {
        console.error('Request timeout - server took too long to respond');
      } else {
        console.error('Network error:', err.message);
      }
    }
    
    if (err?.response?.status === 401) {
      localStorage.removeItem('li_token');
      // Redirect to login if not already there (only on protected routes)
      if (typeof window !== 'undefined' && !['/login', '/register'].includes(window.location.pathname)) {
        window.location.assign('/login');
      }
    }
    
    // Retry logic for timeout errors
    if (err.code === 'ECONNABORTED' && (!retryCount[err.config.url] || retryCount[err.config.url] < MAX_RETRIES)) {
      retryCount[err.config.url] = (retryCount[err.config.url] || 0) + 1;
      console.warn(`Retrying request (attempt ${retryCount[err.config.url]}/${MAX_RETRIES})`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount[err.config.url]));
      return client.request(err.config);
    }
    
    return Promise.reject(err);
  }
);

export default client;
