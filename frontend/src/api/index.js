import c from './client';

export const authApi = {
  register: (d) => c.post('/auth/register', d).then((r) => r.data),
  login: (d) => c.post('/auth/login', d).then((r) => r.data),
  verifyEmail: (d) => c.post('/auth/verify-email', d).then((r) => r.data),
  verifyOtp: (d) => c.post('/auth/verify-otp', d).then((r) => r.data),
  resendVerification: (d) => c.post('/auth/resend-verification', d).then((r) => r.data),
  resendOtp: (d) => c.post('/auth/resend-otp', d).then((r) => r.data),
  me: () => c.get('/auth/me').then((r) => r.data),
  logout: () => c.post('/auth/logout').then((r) => r.data),
  // Fallback to the current origin at runtime when the env var is empty or just '/'
  // (useful when the frontend is served from the same host as the backend)
  googleLoginUrl: () => {
    const rawBackendUrl = process.env.REACT_APP_BACKEND_URL?.trim() || '';
    const normalizedBackendUrl = rawBackendUrl === '/' ? '' : rawBackendUrl.replace(/\/$/, '');
    return `${normalizedBackendUrl || window.location.origin}/api/auth/google/login`;
  },
};

export const usersApi = {
  get: (id) => c.get(`/users/${id}`).then((r) => r.data),
  search: (q) => c.get(`/users/search?q=${encodeURIComponent(q)}`).then((r) => r.data),
  updateMe: (d) => c.put('/users/me', d).then((r) => r.data),
  suggestions: (limit = 10) => c.get(`/users/me/suggestions?limit=${limit}`).then((r) => r.data),
  pending: (limit = 10) => c.get(`/users/me/suggestions?limit=${limit}`).then((r) => r.data),
};

export const postsApi = {
  list: (cursor, company_id) => {
    const params = [];
    if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
    if (company_id) params.push(`company_id=${encodeURIComponent(company_id)}`);
    const qs = params.length ? `?${params.join('&')}` : '';
    return c.get(`/posts${qs}`).then((r) => r.data);
  },
  create: (d) => c.post('/posts', d).then((r) => r.data),
  remove: (id) => c.delete(`/posts/${id}`).then((r) => r.data),
  update: (id, d) => c.put(`/posts/${id}`, d).then((r) => r.data),
  like: (id) => c.post(`/posts/${id}/like`).then((r) => r.data),
  react: (id, reactionType = 'like') => c.post(`/posts/${id}/reaction`, { reaction_type: reactionType }).then((r) => r.data),
  comments: (id) => c.get(`/posts/${id}/comments`).then((r) => r.data),
  addComment: (id, text, parentCommentId = null) => c.post(`/posts/${id}/comments`, { text, parent_comment_id: parentCommentId }).then((r) => r.data),
};

export const connectionsApi = {
  invitations: () => c.get('/connections/invitations').then((r) => r.data),
  request: (receiver_id, note = '') => c.post('/connections/request', { receiver_id, note }).then((r) => r.data),
  accept: (id) => c.post(`/connections/${id}/accept`).then((r) => r.data),
  ignore: (id) => c.post(`/connections/${id}/ignore`).then((r) => r.data),
  list: () => c.get('/connections/me').then((r) => r.data),
  mine: () => c.get('/connections/me').then((r) => r.data),
  network: () => c.get('/connections/network').then((r) => r.data),
  pending: () => c.get('/connections/pending-sent').then((r) => r.data),
  pendingSent: () => c.get('/connections/pending-sent').then((r) => r.data),
};

export const jobsApi = {
  list: (q = '', loc = '') => c.get(`/jobs?q=${encodeURIComponent(q)}&location=${encodeURIComponent(loc)}`).then((r) => r.data),
  get: (id) => c.get(`/jobs/${id}`).then((r) => r.data),
  apply: (id) => c.post(`/jobs/${id}/apply`).then((r) => r.data),
  save: (id) => c.post(`/jobs/${id}/save`).then((r) => r.data),
  saved: () => c.get('/jobs/me/saved').then((r) => r.data),
  applied: () => c.get('/jobs/me/applied').then((r) => r.data),
  createPosting: (d) => c.post('/jobs/postings', d).then((r) => r.data),
  getCompanyPostings: (company_id) => c.get(`/jobs/postings/${company_id}`).then((r) => r.data),
  createSeekerRequest: (d) => c.post('/jobs/seeker-requests', d).then((r) => r.data),
  listSeekerRequests: (q = '') => c.get(`/jobs/seeker-requests?q=${encodeURIComponent(q)}`).then((r) => r.data),
  getMySeekerRequests: () => c.get('/jobs/seeker-requests/me').then((r) => r.data),
  updateSeekerRequest: (id, d) => c.put(`/jobs/seeker-requests/${id}`, d).then((r) => r.data),
  deleteSeekerRequest: (id) => c.delete(`/jobs/seeker-requests/${id}`).then((r) => r.data),
  // Applications management
  getApplicants: (job_id) => c.get(`/jobs/posting/${job_id}/applicants`).then((r) => r.data),
  decideApplication: (app_id, action, reason = '') => c.post(`/jobs/application/${app_id}/decide`, { action, reason }).then((r) => r.data),
};

export const messagesApi = {
  conversations: () => c.get('/conversations').then((r) => r.data),
  thread: (id) => c.get(`/conversations/${id}/messages`).then((r) => r.data),
  send: (id, text) => c.post(`/conversations/${id}/messages`, { text }).then((r) => r.data),
  start: (user_id) => c.post('/conversations', { user_id }).then((r) => r.data),
};

export const notificationsApi = {
  list: (filter = 'all') => c.get(`/notifications?filter=${filter}`).then((r) => r.data),
  read: (id) => c.post(`/notifications/${id}/read`).then((r) => r.data),
  readAll: () => c.post('/notifications/read-all').then((r) => r.data),
};

export const newsApi = {
  list: () => c.get('/news').then((r) => r.data),
};

export const uploadApi = {
  signature: (folder = 'uploads/', resource_type = 'image') =>
    c.get(`/cloudinary/signature?folder=${encodeURIComponent(folder)}&resource_type=${resource_type}`).then((r) => r.data),
  uploadFile: async (file, folder = 'uploads/') => {
    try {
      const sig = await uploadApi.signature(folder, 'image');
      if (!sig || !sig.signature) {
        throw new Error('Failed to get upload signature from server');
      }
      
      const form = new FormData();
      form.append('file', file);
      form.append('api_key', sig.api_key);
      form.append('timestamp', sig.timestamp);
      form.append('signature', sig.signature);
      form.append('folder', sig.folder);
      form.append('resource_type', sig.resource_type);
      
      const res = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloud_name}/image/upload`, { 
        method: 'POST', 
        body: form 
      });
      
      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error?.message || `Upload failed: ${res.statusText}`);
      }
      
      return data;
    } catch (err) {
      console.error('Upload API error:', err);
      throw err;
    }
  },
};

export const searchApi = {
  query: (q, type = 'all') => c.get(`/search?q=${encodeURIComponent(q)}&type=${type}`).then((r) => r.data),
};

export const repostApi = {
  repost: (id, comment = '') => c.post(`/posts/${id}/repost`, { comment }).then((r) => r.data),
};

export const verificationApi = {
  submit: (d) => c.post('/verification/request', d).then((r) => r.data),
  me: () => c.get('/verification/me').then((r) => r.data),
};

export const adminApi = {
  stats: () => c.get('/admin/stats').then((r) => r.data),
  users: (q = '') => c.get(`/admin/users?q=${encodeURIComponent(q)}`).then((r) => r.data),
  toggleVerify: (id) => c.post(`/admin/users/${id}/verify`).then((r) => r.data),
  deleteUser: (id) => c.delete(`/admin/users/${id}`).then((r) => r.data),
  verifications: (status = 'pending') => c.get(`/admin/verification-requests?status=${status}`).then((r) => r.data),
  approve: (id) => c.post(`/admin/verification-requests/${id}/approve`).then((r) => r.data),
  reject: (id) => c.post(`/admin/verification-requests/${id}/reject`).then((r) => r.data),
  companyRequests: (status = 'pending') => c.get(`/admin/company-requests?status=${status}`).then((r) => r.data),
  decideCompany: (id, action, reason = '') => c.post(`/admin/company-requests/${id}/decide`, { action, reason }).then((r) => r.data),
  companies: (status = 'approved') => c.get(`/admin/companies?status=${status}`).then((r) => r.data),
  deleteCompany: (id) => c.delete(`/admin/companies/${id}`).then((r) => r.data),
};

export const companyRequestsApi = {
  myRequests: () => c.get('/company-requests/me').then((r) => r.data),
};

export const companiesApi = {
  get: (id) => c.get(`/companies/${id}`).then((r) => r.data),
  list: (q = '', skip = 0, limit = 20) => c.get(`/companies?q=${encodeURIComponent(q)}&skip=${skip}&limit=${limit}`).then((r) => r.data),
  myCompanies: () => c.get('/companies/me').then((r) => r.data),
  create: (d) => c.post('/companies', d).then((r) => r.data),
  update: (id, d) => c.put(`/companies/${id}`, d).then((r) => r.data),
  addEmployee: (companyId, d) => c.post(`/companies/${companyId}/employees`, d).then((r) => r.data),
  updateEmployee: (companyId, employeeId, d) => c.put(`/companies/${companyId}/employees/${employeeId}`, d).then((r) => r.data),
  removeEmployee: (companyId, employeeId) => c.delete(`/companies/${companyId}/employees/${employeeId}`).then((r) => r.data),
  requestCreation: (d) => c.post('/companies/request', d).then((r) => r.data),
  // Position requests
  sendPositionRequest: (companyId, d) => c.post(`/companies/${companyId}/position-requests`, d).then((r) => r.data),
  getReceivedRequests: (status = 'pending') => c.get(`/position-requests/received?status=${status}`).then((r) => r.data),
  getSentRequests: (companyId, status = 'pending') => c.get(`/position-requests/sent/${companyId}?status=${status}`).then((r) => r.data),
  acceptPositionRequest: (requestId) => c.put(`/position-requests/${requestId}/accept`).then((r) => r.data),
  rejectPositionRequest: (requestId) => c.put(`/position-requests/${requestId}/reject`).then((r) => r.data),
};

export const recommendationsApi = {
  give: (user_id, text) => c.post('/recommendations', { user_id, text }).then((r) => r.data),
  getFor: (user_id) => c.get(`/recommendations/user/${user_id}`).then((r) => r.data),
  getMine: () => c.get('/recommendations/me').then((r) => r.data),
  delete: (id) => c.delete(`/recommendations/${id}`).then((r) => r.data),
};

export const endorsementsApi = {
  endorse: (user_id, skill) => c.post('/endorsements', { user_id, skill }).then((r) => r.data),
  getFor: (user_id) => c.get(`/endorsements/user/${user_id}`).then((r) => r.data),
  remove: (id) => c.delete(`/endorsements/${id}`).then((r) => r.data),
};

export const reportsApi = {
  submit: (target_type, target_id, reason, details = '') => 
    c.post('/reports', { target_type, target_id, reason, details }).then((r) => r.data),
  list: (status = 'pending') => 
    c.get(`/reports?status=${status}`).then((r) => r.data),
  resolve: (report_id, action = 'dismiss', reason = '') => {
    // إرسال السبب في body عند الحاجة
    if (reason && (action === 'reject' || action === 'suspend' || action === 'dismiss')) {
      return c.post(`/reports/${report_id}/resolve?action=${action}`, { reason }).then((r) => r.data);
    }
    return c.post(`/reports/${report_id}/resolve?action=${action}`).then((r) => r.data);
  },
};
