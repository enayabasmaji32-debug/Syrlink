import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { authApi, postsApi, companiesApi, usersApi, connectionsApi, jobsApi, messagesApi, notificationsApi } from '../api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import translations from '../i18n/translations';

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

  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [ownedCompanies, setOwnedCompanies] = useState([]);
  const [activeCompanyId, setActiveCompanyId] = useState(localStorage.getItem('li_active_company') || '');
  const [people, setPeople] = useState([]);
  const [networkUsers, setNetworkUsers] = useState([]); // All users with relationship status
  const [invitations, setInvitations] = useState([]);
  const [connections, setConnections] = useState(new Set());
  const [pendingSent, setPendingSent] = useState(new Set());
  const [savedJobs, setSavedJobs] = useState(new Set());
  const [appliedJobs, setAppliedJobs] = useState(new Set());
  const [conversations, setConversations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [language, setLanguage] = useState(() => localStorage.getItem('li_language') || 'ar');
  const [createContentType, setCreateContentType] = useState(null); // 'post' | 'article' | 'event'

  // WebSocket for real-time online status
  const { onlineUsers, isUserOnline } = useOnlineStatus();

  // On mount: try to restore session - NON-BLOCKING
  useEffect(() => {
    let storedConsent = getCookie('li_cookie_consent') === 'yes';

    // Auto-accept cookies on first visit to allow seamless authentication
    if (!storedConsent) {
      setCookie('li_cookie_consent', 'yes', { maxAge: 31536000 }); // 1 year
      storedConsent = true;
    }

    authApi.me()
      .then((me) => {
        setUser(me);
        setAuthReady(true);
      })
      .catch(() => {
        localStorage.removeItem('li_token');
        eraseCookie('li_token');
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
      companiesApi.myCompanies().then(setOwnedCompanies).catch((err) => {
        console.warn('Failed loading companies', err);
        setOwnedCompanies([]);
      }),
      connectionsApi.network().then((data) => setNetworkUsers(Array.isArray(data) ? data : [])).catch((err) => {
        console.warn('Failed loading network users', err);
        setNetworkUsers([]);
      }),
      usersApi.suggestions().then((data) => setPeople(Array.isArray(data) ? data : [])).catch((err) => {
        console.warn('Failed loading suggestions', err);
        setPeople([]);
      }),
      connectionsApi.list().then((data) => {
        setConnections(new Set((data || []).map((c) => c.id)));
      }).catch((err) => {
        console.warn('Failed loading connections list', err);
      }),
      connectionsApi.pending().then((data) => {
        setInvitations(Array.isArray(data) ? data : []);
      }).catch((err) => {
        console.warn('Failed loading pending invitations', err);
        setInvitations([]);
      }),
      jobsApi.saved().then((ids) => setSavedJobs(new Set(ids || []))).catch((err) => {
        console.warn('Failed loading saved jobs', err);
      }),
      messagesApi.conversations().then(setConversations).catch((err) => {
        console.warn('Failed loading conversations', err);
      }),
    ]);
  }, []);

  // Only refresh when user first becomes available (prevents unnecessary re-renders on every user object mutation)
  useEffect(() => { 
    if (user) { 
      refreshAll(user); 
    } 
  }, [user?.id]);

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

  // Load notifications when user changes (only on mount and when user changes, polling with reduced frequency)
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const list = await notificationsApi.list();
        setNotifications(list);
      } catch (err) {
        console.warn('[AppContext] Failed loading notifications', err);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !interval) {
        interval = setInterval(fetchNotifications, 45000);
      } else if (document.hidden && interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    let interval = null;
    fetchNotifications();

    if (!document.hidden) {
      interval = setInterval(fetchNotifications, 45000);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]); // Only depend on user.id to prevent recreating interval

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout request failed, clearing local session anyway', err);
    }
    localStorage.removeItem('li_token');
    localStorage.removeItem('li_active_company');
    eraseCookie('li_token');
    setUser(null);
    setPosts([]); setCommentsByPost({}); setOwnedCompanies([]); setActiveCompanyId(''); setPeople([]); setNetworkUsers([]); setInvitations([]);
    setConnections(new Set()); setPendingSent(new Set());
    setSavedJobs(new Set()); setAppliedJobs(new Set());
    setConversations([]); setNotifications([]);
  };

  const addPost = async (content, image, company_id = null) => {
    try {
      const payload = {
        content: content || '',
        image: image?.trim() ? image : null,
        visibility: 'Anyone',
        company_id: company_id || null,
      };
      console.log('[addPost] Sending:', payload);
      const created = await postsApi.create(payload);
      console.log('[addPost] Response:', created);
      if (!created?.id) {
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

  const toggleLike = async (postId, reactionType = 'like') => {
    // Get current state to determine optimistic update
    const currentPost = posts.find(p => p.id === postId);
    const currentReaction = currentPost?.reaction;
    const isToggling = currentReaction === reactionType; // Same reaction = remove
    
    try {
      if (reactionType && reactionType !== 'like') {
        // Switching to/from reaction type
        setPosts((all) => all.map((p) => p.id === postId
          ? { ...p, liked: !isToggling, reaction: isToggling ? null : reactionType, likes: p.likes + (isToggling ? -1 : currentReaction ? 0 : 1) }
          : p));
        
        const res = await postsApi.react(postId, reactionType);
        const newLikes = res.count ?? res.likes_count ?? undefined;
        setPosts((all) => all.map((p) => p.id === postId
          ? { ...p, liked: res.reaction !== null, likes: typeof newLikes === 'number' ? newLikes : p.likes, reaction: res.reaction }
          : p));
      } else {
        // Default like
        setPosts((all) => all.map((p) => p.id === postId
          ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1), reaction: p.liked ? null : 'like' }
          : p));
        
        const res = await postsApi.like(postId);
        const newLikes = res.count ?? res.likes_count ?? undefined;
        setPosts((all) => all.map((p) => p.id === postId
          ? { ...p, liked: res.liked, likes: typeof newLikes === 'number' ? newLikes : p.likes, reaction: res.liked ? 'like' : null }
          : p));
      }
    } catch (e) {
      // revert on error
      setPosts((all) => all.map((p) => p.id === postId ? currentPost : p));
      console.error('[toggleLike] Error:', e);
    }
  };

  const loadComments = async (postId) => {
    const list = await postsApi.comments(postId);
    setCommentsByPost((all) => ({ ...all, [postId]: list }));
  };

  const addComment = async (postId, text, parentCommentId = null) => {
    const c = await postsApi.addComment(postId, text, parentCommentId);
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
    // Update UI optimistically
    setNetworkUsers((users) => users.map((u) => u.id === userId ? { ...u, relationship: 'pending_sent' } : u));
    try {
      await connectionsApi.request(userId);
    } catch (e) {
      console.warn('[sendConnect] request failed', e);
      setNetworkUsers((users) => users.map((u) => u.id === userId ? { ...u, relationship: 'not_connected' } : u));
    }
  };

  const acceptInvite = async (inviteId, userId = null) => {
    try {
      const inv = userId ? null : invitations.find((i) => i.id === inviteId);
      const actualUserId = userId || inv?.user?.id;
      console.log('[acceptInvite] Accepting:', inviteId, 'User:', actualUserId);
      
      await connectionsApi.accept(inviteId);
      
      // Update states
      setInvitations((all) => all.filter((i) => i.id !== inviteId));
      if (actualUserId) setConnections((c) => new Set([...c, actualUserId]));
      
      // Update networkUsers
      if (actualUserId) {
        setNetworkUsers((users) => users.map((u) => u.id === actualUserId ? { ...u, relationship: 'connected' } : u));
      }
      
      console.log('[acceptInvite] Success');
    } catch (e) {
      console.error('[acceptInvite] Error:', e?.response?.status, e?.response?.data, e?.message);
      throw e;
    }
  };

  const ignoreInvite = async (inviteId, userId = null) => {
    try {
      const inv = userId ? null : invitations.find((i) => i.id === inviteId);
      const actualUserId = userId || inv?.user?.id;
      console.log('[ignoreInvite] Ignoring:', inviteId);
      
      await connectionsApi.ignore(inviteId);
      
      // Update states
      setInvitations((all) => all.filter((i) => i.id !== inviteId));
      
      // Update networkUsers
      if (actualUserId) {
        setNetworkUsers((users) => users.map((u) => u.id === actualUserId ? { ...u, relationship: 'not_connected' } : u));
      }
      
      console.log('[ignoreInvite] Success');
    } catch (e) {
      console.error('[ignoreInvite] Error:', e?.response?.status, e?.response?.data, e?.message);
      throw e;
    }
  };

  const toggleSaveJob = async (jobId) => {
    const wasSaved = savedJobs.has(jobId);
    setSavedJobs((s) => {
      const n = new Set(s);
      if (wasSaved) {
        n.delete(jobId);
      } else {
        n.add(jobId);
      }
      return n;
    });
    try {
      await jobsApi.save(jobId);
    } catch (e) {
      console.warn('[toggleSaveJob] failed to save job', e);
      setSavedJobs((s) => {
        const n = new Set(s);
        if (wasSaved) {
          n.add(jobId);
        } else {
          n.delete(jobId);
        }
        return n;
      });
    }
  };

  const applyJob = async (jobId) => {
    setAppliedJobs((s) => new Set([...s, jobId]));
    try {
      await jobsApi.apply(jobId);
    } catch (e) {
      console.warn('[applyJob] apply failed', e);
      setAppliedJobs((s) => {
        const n = new Set(s);
        n.delete(jobId);
        return n;
      });
    }
  };

  const sendMessage = async (convId, text) => {
    try {
      const payload = { text: text?.trim() || '' };
      if (!payload.text) throw new Error('Message cannot be empty');
      console.log('[sendMessage] Sending to', convId, ':', payload);
      const msg = await messagesApi.send(convId, payload.text);
      console.log('[sendMessage] Response:', msg);
      if (!msg?.id) {
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

  const upsertConversation = useCallback((conversation) => {
    setConversations((convs) => {
      const existingIndex = convs.findIndex((c) => c.id === conversation.id);
      if (existingIndex !== -1) {
        const updated = [...convs];
        updated[existingIndex] = { ...updated[existingIndex], ...conversation };
        return updated;
      }
      return [...convs, conversation];
    });
  }, []);

  const markNotificationRead = async (id) => {
    setNotifications((all) => all.map((n) => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationsApi.read(id);
    } catch (e) {
      console.warn('[markNotificationRead] failed to mark notification read', e);
    }
  };

  const unreadNotifCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const unreadMsgCount = useMemo(() => conversations.filter((c) => c.unread).length, [conversations]);

  // Language management - use useMemo to prevent translation function re-creation
  const translationMemo = useMemo(() => translations[language] || translations.en, [language]);
  
  const changeLanguage = useCallback((lang) => {
    if (['ar', 'en'].includes(lang) && lang !== language) {
      setLanguage(lang);
      localStorage.setItem('li_language', lang);
      // Batch DOM updates to prevent reflow
      requestAnimationFrame(() => {
        document.documentElement.lang = lang;
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      });
    }
  }, [language]);

  // Memoized translation function to prevent unnecessary re-renders
  const t = useCallback((key) => {
    return translationMemo?.[key] || translations.en?.[key] || key;
  }, [translationMemo]);

  const value = useMemo(() => ({
    user, authReady, logout, setUser,
    posts, commentsByPost, addPost, toggleLike, addComment, loadComments, repostPost, deletePost, updatePost,
    ownedCompanies, activeCompany, setActiveCompany,
    people, networkUsers, invitations, connections, pendingSent,
    sendConnect, acceptInvite, ignoreInvite,
    savedJobs, appliedJobs, toggleSaveJob, applyJob,
    conversations, sendMessage, loadThread, upsertConversation,
    notifications, markNotificationRead, unreadNotifCount, unreadMsgCount,
    refreshAll,
    onlineUsers, isUserOnline,
    language, changeLanguage, t,
    createContentType, setCreateContentType,
  }), [
    user, authReady, posts, commentsByPost, ownedCompanies, activeCompany, people, networkUsers, invitations,
    connections, pendingSent, savedJobs, appliedJobs, conversations, notifications, language, createContentType,
    onlineUsers, upsertConversation
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

AppProvider.propTypes = {
  children: PropTypes.node,
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
