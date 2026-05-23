import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, Building2, Briefcase, MessageSquare, Bell, Search, ChevronDown, LogOut, ShieldCheck, BadgeCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { searchApi } from '../api';

function NavTab({ to, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      data-testid={`nav-${label.toLowerCase()}`}
    >
      <div className="relative">
        <Icon className="w-6 h-6" />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-[#cc1016] text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-semibold">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-[11px] leading-tight mt-0.5">{label}</span>
    </NavLink>
  );
}

export default function Navbar() {
  const { user, unreadMsgCount, unreadNotifCount, logout } = useApp();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => {
      searchApi.query(q).then(setResults).catch(() => setResults(null));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 h-[52px] bg-white border-b border-[#e0dfdc] z-30">
      <div className="max-w-[1128px] mx-auto h-full flex items-center px-2 sm:px-4 gap-2">
        <Link to="/" className="flex items-center gap-2" data-testid="navbar-logo">
          <img src="/syrlink-logo.png" alt="SyrLink" className="w-9 h-9 object-contain" />
          <span className="hidden sm:inline text-[#0a66c2] font-bold text-lg tracking-tight">SyrLink</span>
        </Link>
        <div className="relative ml-1 flex-1 max-w-[280px]" ref={searchRef}>
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            placeholder="Search SyrLink"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            className="w-full h-9 bg-[#edf3f8] rounded pl-9 pr-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
            data-testid="navbar-search"
          />
          {searchOpen && results && (q.trim().length > 0) && (
            <div className="absolute top-11 left-0 right-0 w-[420px] -ml-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[440px] overflow-y-auto z-40" data-testid="search-results">
              {results.users?.length > 0 && (
                <div className="p-2">
                  <div className="text-[11px] font-bold uppercase text-gray-500 px-2">People</div>
                  {results.users.map((u) => (
                    <Link key={u.id} to={`/in/${u.id}`} onClick={() => { setSearchOpen(false); setQ(''); }}
                      className="flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded" data-testid={`search-user-${u.id}`}>
                      <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-1">{u.name}{u.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0a66c2]" fill="#0a66c2" stroke="white" />}</div>
                        <div className="text-xs text-gray-600 truncate">{u.headline}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {results.jobs?.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="text-[11px] font-bold uppercase text-gray-500 px-2">Jobs</div>
                  {results.jobs.map((j) => (
                    <Link key={j.id} to="/jobs" onClick={() => { setSearchOpen(false); setQ(''); }}
                      className="flex items-center gap-2 px-2 py-2 hover:bg-gray-100 rounded">
                      <img src={j.logo} alt="" className="w-8 h-8 rounded object-cover" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{j.title}</div>
                        <div className="text-xs text-gray-600 truncate">{j.company} · {j.location}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {results.posts?.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="text-[11px] font-bold uppercase text-gray-500 px-2">Posts</div>
                  {results.posts.map((p) => (
                    <div key={p.id} className="px-2 py-2 hover:bg-gray-100 rounded">
                      <div className="text-xs font-semibold text-gray-700">{p.author?.name}</div>
                      <div className="text-xs text-gray-600 line-clamp-2">{p.content}</div>
                    </div>
                  ))}
                </div>
              )}
              {!results.users?.length && !results.jobs?.length && !results.posts?.length && (
                <div className="p-4 text-center text-sm text-gray-500">No results for "{q}"</div>
              )}
            </div>
          )}
        </div>
        <nav className="flex items-center ml-auto h-full">
          <NavTab to="/" icon={Home} label="Home" />
          <NavTab to="/mynetwork" icon={Users} label="Network" />
          <NavTab to="/companies" icon={Building2} label="Companies" />
          <NavTab to="/jobs" icon={Briefcase} label="Jobs" />
          <NavTab to="/messaging" icon={MessageSquare} label="Messaging" badge={unreadMsgCount} />
          <NavTab to="/notifications" icon={Bell} label="Notifications" badge={unreadNotifCount} />
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="nav-item"
              data-testid="navbar-me-button"
            >
              <img
                src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || 'U')}`}
                alt={user?.name}
                className="w-6 h-6 rounded-full object-cover"
              />
              <span className="text-[11px] leading-tight mt-0.5 flex items-center">
                Me <ChevronDown className="w-3 h-3" />
              </span>
            </button>
            {open && (
              <div
                className="absolute right-0 top-[52px] w-64 bg-white border border-[#e0dfdc] rounded-lg shadow-lg p-3 z-40"
                onMouseLeave={() => setOpen(false)}
                data-testid="navbar-me-dropdown"
              >
                <div className="flex items-start gap-2">
                  <img src={user?.avatar} alt={user?.name} className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{user?.name}</div>
                    <p className="text-xs text-gray-600 line-clamp-2">{user?.headline}</p>
                  </div>
                </div>
                <Link
                  to="/me"
                  onClick={() => setOpen(false)}
                  className="mt-3 block w-full text-center border border-[#0a66c2] text-[#0a66c2] rounded-full text-sm font-semibold py-1 hover:bg-[#0a66c2]/10"
                  data-testid="navbar-view-profile"
                >
                  View Profile
                </Link>
                <Link to="/my-company-requests" onClick={() => setOpen(false)} data-testid="navbar-company-requests-link"
                  className="mt-2 w-full flex items-center justify-center gap-2 text-sm text-gray-700 hover:bg-gray-100 rounded py-1.5 font-semibold">
                  <Briefcase className="w-4 h-4" /> My Company Requests
                </Link>
                <Link to="/my-applications" onClick={() => setOpen(false)} data-testid="navbar-my-applications-link"
                  className="mt-2 w-full flex items-center justify-center gap-2 text-sm text-gray-700 hover:bg-gray-100 rounded py-1.5 font-semibold">
                  <Briefcase className="w-4 h-4" /> My Applications
                </Link>
                {user?.is_admin && (
                  <Link to="/admin" onClick={() => setOpen(false)} data-testid="navbar-admin-link"
                    className="mt-2 w-full flex items-center justify-center gap-2 text-sm text-red-700 hover:bg-red-50 rounded py-1.5 font-semibold">
                    <ShieldCheck className="w-4 h-4" /> Admin Panel
                  </Link>
                )}
                <button
                  onClick={() => { setOpen(false); logout(); navigate('/login'); }}
                  className="mt-2 w-full flex items-center justify-center gap-2 text-sm text-gray-700 hover:bg-gray-100 rounded py-1.5 font-semibold"
                  data-testid="navbar-logout"
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
