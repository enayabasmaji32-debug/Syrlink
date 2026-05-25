import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authApi, postsApi, companiesApi, usersApi, connectionsApi, jobsApi, messagesApi, notificationsApi } from '../api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const AppContext = createContext(null);

const getCookie = (name) => {
  if (typeof document === 'undefined') return '';
  const regex = new RegExp(`(?:^|; )${name}=([^;]*)`);
  const match = regex.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : '';
};

const setCookie = (name, value, options = {}) => {
  if (typeof document === 'undefined') return;
  const opts = { path: '/', sameSite: 'Lax', ...options };
  let cookieString = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge) cookieString += `; max-age=${opts.maxAge}`;
  if (opts.path) cookieString += `; path=${opts.path}`;
  if (opts.sameSite) cookieString += `; samesite=${opts.sameSite}`;
  if (opts.secure) cookieString += `; secure`;
  document.cookie = cookieString;
};

const eraseCookie = (name) => {
  setCookie(name, '', { maxAge: 0 });
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('li_token'));

  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [ownedCompanies, setOwnedCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(localStorage.getItem('li_active_company') || '');
  const [people, setPeople] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [connections, setConnections] = useState(new Set());
  const [pendingSent, setPendingSent] = useState(new Set());
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // WebSocket for real-time online status
  const { onlineUsers, isUserOnline } = useOnlineStatus(token);

  // On mount: try to restore session - NON-BLOCKING
  useEffect(() => {
    const storedConsent = getCookie('li_cookie_consent') === 'yes';
    const storedToken = localStorage.getItem('li_token');

    if (!storedConsent) {
      localStorage.removeItem('li_token');
      eraseCookie('li_token');
      setAuthReady(true);
      return;
    }

    if (storedToken) {
      setToken(storedToken);
    }

    authApi.me()
      .then((me) => {
        setUser(me);
        setAuthReady(true);
      })
      .catch(() => {
        localStorage.removeItem('li_token');
        eraseCookie('li_token');
        setToken(null);
        setUser(null);
        setAuthReady(true);
      });
  }, []);

  // Optimized data loading: Load critical data first, then secondary data
  const refreshAll = useCallback(async (currentUser = user) => {
    if (!currentUser) return;
    
    try {
      // Phase 1: posts أولاً علشان المستخدم يشوف شي فوراً
      const postsRes = await postsApi.list().catch(() => ({ items: [] }));
      setPosts(postsRes.items || []);
    } catch (e) {
      console.error('Failed loading posts', e);
    }

    // Phase 2: باقي البيانات بالتوازي بدون await (ما تبلّك الـ UI)
    Promise.allSettled([
      companiesApi.myCompanies().then(setOwnedCompanies).catch(() => {}),
      usersApi.suggestions().then((data) => setPeople(Array.isArray(data) ? data : [])).catch(() => setPeople([])),
      connectionsApi.list().then((data) => {
        setConnections(new Set((data || []).map((c) => c.id)));
      }).catch(() => {}),
      connectionsApi.pending().then((data) => {
        setInvitations(Array.isArray(data) ? data : []);
      }).catch(() => setInvitations([])),
      jobsApi.saved().then((ids) => setSavedJobs(new Set(ids || []))).catch(() => {}),
      messagesApi.conversations().then(setConversations).catch(() => {}),
    ]);
  }, [user]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const activeCompany = useMemo(
    () => ownedCompanies.find((c) => c.id === activeCompanyId) || null,
    [ownedCompanies, activeCompanyId]
  );

  const setActiveCompany = useCallback((companyId) => {
    if (!companyId) {
      localStorage.removeItem('li_active_company');
      setActiveCompanyId('');
      return;
    }
    localStorage.setItem('li_active_company', companyId);
    setActiveCompanyId(companyId);
  }, []);

  const loadOwnedCompanies = useCallback(async (currentUser = user) => {
    if (!currentUser) {
      setOwnedCompanies([]);
      setActiveCompanyId('');
      return;
    }

    try {
      const companies = await companiesApi.myCompanies();
      setOwnedCompanies(companies || []);
      const storedCompanyId = localStorage.getItem('li_active_company');
      if (storedCompanyId && companies?.some((c) => c.id === storedCompanyId)) {
        setActiveCompanyId(storedCompanyId);
      } else if (companies?.[0]) {
        setActiveCompanyId(companies[0].id);
        localStorage.setItem('li_active_company', companies[0].id);
      } else {
        setActiveCompanyId('');
        localStorage.removeItem('li_active_company');
      }
    } catch (e) {
      console.error('Failed loading owned companies', e);
      setOwnedCompanies([]);
      setActiveCompanyId('');
    }
  }, [user]);

  useEffect(() => {
    loadOwnedCompanies();
  }, [user, loadOwnedCompanies]);

  // Load notifications when user changes
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    notificationsApi.list()
      .then(setNotifications)
      .catch((e) => console.error('Failed loading notifications', e));
    
    // Poll for new notifications every 10 seconds
    const interval = setInterval(() => {
      notificationsApi.list()
        .then(setNotifications)
        .catch(() => {});
    }, 10000);
    
    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password) => {
    const { token, user: u } = await authApi.login({ email, password });
    localStorage.setItem('li_token', token);
    setCookie('li_cookie_consent', 'yes', { maxAge: 31536000 });
    setToken(token);
    setUser(u);
    setTimeout(() => {
      refreshAll(u);
      loadOwnedCompanies(u);
    }, 200);
    return u;
  };

  const register = async (data) => {
    const { token, user: u } = await authApi.register(data);
    localStorage.setItem('li_token', token);
    setCookie('li_cookie_consent', 'yes', { maxAge: 31536000 });
    setToken(token);
    setUser(u);
    setTimeout(() => {
      refreshAll(u);
      loadOwnedCompanies(u);
    }, 200);
    return u;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout request failed, clearing local session anyway', err);
    }
    localStorage.removeItem('li_token');
    localStorage.removeItem('li_active_company');
    eraseCookie('li_token');
    setToken(null);
    setUser(null);
    setPosts([]); setCommentsByPost({}); setOwnedCompanies([]); setActiveCompanyId(''); setPeople([]); setInvitations([]);
    setConnections(new Set()); setPendingSent(new Set());
    setSavedJobs(new Set()); setAppliedJobs(new Set());
    setConversations([]); setNotifications([]);
  };

  const addPost = async (content, image, company_id = null) => {
    try {
      const payload = {
        content: content || '',
        image: image && image.trim() ? image : null,
        visibility: 'Anyone',
        company_id: company_id || null,
      };
      console.log('[addPost] Sending:', payload);
      const created = await postsApi.create(payload);
      console.log('[addPost] Response:', created);
      if (!created || !created.id) {
        throw new Error('Invalid response from server: missing post ID');
      }
      setPosts((p) => [created, ...p]);
    } catch (e) {
      console.error('[addPost] Error:', e?.response?.status, e?.response?.data, e?.message);
      throw e;
    }
  };

  const repostPost = async (postId, comment = '') => {
    const { repostApi } = await import('../api');
    const created = await repostApi.repost(postId, comment);
    setPosts((p) => [created, ...p]);
    setPosts((all) => all.map((p) => p.id === postId ? { ...p, reposts: (p.reposts || 0) + 1 } : p));
  };

  const toggleLike = async (postId) => {
    // optimistic
    setPosts((all) => all.map((p) => p.id === postId
      ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }
      : p));
    try {
      const res = await postsApi.like(postId);
      setPosts((all) => all.map((p) => p.id === postId
        ? { ...p, liked: res.liked, likes: res.likes_count }
        : p));
    } catch (e) {
      // revert
      setPosts((all) => all.map((p) => p.id === postId
        ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }
        : p));
    }
  };

  const loadComments = async (postId) => {
    const list = await postsApi.comments(postId);
    setCommentsByPost((all) => ({ ...all, [postId]: list }));
  };

  const addComment = async (postId, text) => {
    const c = await postsApi.addComment(postId, text);
    setCommentsByPost((all) => ({ ...all, [postId]: [...(all[postId] || []), c] }));
    setPosts((all) => all.map((p) => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
  };

  const deletePost = async (postId) => {
    await postsApi.remove(postId);
    setPosts((all) => all.filter((p) => p.id !== postId));
  };

  const updatePost = async (postId, data) => {
    const updated = await postsApi.update(postId, data);
    setPosts((all) => all.map((p) => p.id === postId ? { ...p, ...updated } : p));
    return updated;
  };

  const sendConnect = async (userId) => {
    setPendingSent((s) => new Set([...s, userId]));
    try { await connectionsApi.request(userId); } catch (e) {
      setPendingSent((s) => { const n = new Set(s); n.delete(userId); return n; });
    }
  };

  const acceptInvite = async (inviteId) => {
    const inv = invitations.find((i) => i.id === inviteId);
    await connectionsApi.accept(inviteId);
    setInvitations((all) => all.filter((i) => i.id !== inviteId));
    if (inv?.user?.id) setConnections((c) => new Set([...c, inv.user.id]));
  };

  const ignoreInvite = async (inviteId) => {
    await connectionsApi.ignore(inviteId);
    setInvitations((all) => all.filter((i) => i.id !== inviteId));
  };

  const toggleSaveJob = async (jobId) => {
    const wasSaved = savedJobs.has(jobId);
    setSavedJobs((s) => {
      const n = new Set(s); if (wasSaved) n.delete(jobId); else n.add(jobId); return n;
    });
    try { await jobsApi.save(jobId); } catch (e) {
      setSavedJobs((s) => { const n = new Set(s); if (wasSaved) n.add(jobId); else n.delete(jobId); return n; });
    }
  };

  const applyJob = async (jobId) => {
    setAppliedJobs((s) => new Set([...s, jobId]));
    try { await jobsApi.apply(jobId); } catch (e) {
      setAppliedJobs((s) => { const n = new Set(s); n.delete(jobId); return n; });
    }
  };

  const sendMessage = async (convId, text) => {
    try {
      const payload = { text: text?.trim() || '' };
      if (!payload.text) throw new Error('Message cannot be empty');
      console.log('[sendMessage] Sending to', convId, ':', payload);
      const msg = await messagesApi.send(convId, payload.text);
      console.log('[sendMessage] Response:', msg);
      if (!msg || !msg.id) {
        throw new Error('Invalid response: missing message ID');
      }
      setConversations((convs) => convs.map((c) => c.id === convId
        ? { ...c, lastMessage: text, timeAgo: 'now', unread: false, thread: [...(c.thread || []), msg] }
        : c));
    } catch (e) {
      console.error('[sendMessage] Error:', e?.response?.status, e?.response?.data, e?.message);
      throw e;
    }
  };

  const loadThread = async (convId) => {
    const data = await messagesApi.thread(convId);
    setConversations((convs) => convs.map((c) => c.id === convId
      ? { ...c, thread: data.thread, unread: false } : c));
  };

  const markNotificationRead = async (id) => {
    setNotifications((all) => all.map((n) => n.id === id ? { ...n, read: true } : n));
    try { await notificationsApi.read(id); } catch (e) {}
  };

  const unreadNotifCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const unreadMsgCount = useMemo(() => conversations.filter((c) => c.unread).length, [conversations]);

  const value = {
    user, authReady, login, register, logout, setUser,
    posts, commentsByPost, addPost, toggleLike, addComment, loadComments, repostPost, deletePost, updatePost,
    ownedCompanies, activeCompany, setActiveCompany,
    people, invitations, connections, pendingSent,
    sendConnect, acceptInvite, ignoreInvite,
    savedJobs, appliedJobs, toggleSaveJob, applyJob,
    conversations, sendMessage, loadThread,
    notifications, markNotificationRead, unreadNotifCount, unreadMsgCount,
    refreshAll,
    onlineUsers, isUserOnline,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
