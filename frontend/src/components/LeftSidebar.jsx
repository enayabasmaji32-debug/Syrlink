import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Users, Plus, Hash, Mail, FileText, CalendarDays, MessageSquare } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LeftSidebar() {
  const { user, setCreateContentType, t } = useApp();
  return (
    <aside className="space-y-2">
      <div className="li-card overflow-hidden">
        <div
          className="h-14 bg-cover bg-center"
          style={{ backgroundImage: `url(${user.cover})` }}
        />
        <div className="px-4 pb-3 -mt-7">
          <Link to="/me">
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-full border-2 border-white object-cover" />
          </Link>
          <Link to="/me" className="block mt-2 font-semibold text-[15px] leading-tight hover:underline">
            {user.name}
          </Link>
          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{user.headline}</p>
        </div>
        <div className="px-4 py-2 border-t border-[#e0dfdc] text-xs space-y-1">
          <div className="flex justify-between hover:bg-gray-100 rounded px-1 py-1 cursor-pointer">
            <span className="text-gray-600">{t('profileViewers')}</span>
            <span className="font-semibold text-[#0a66c2]">—</span>
          </div>
          <div className="flex justify-between hover:bg-gray-100 rounded px-1 py-1 cursor-pointer">
            <span className="text-gray-600">{t('postImpressions')}</span>
            <span className="font-semibold text-[#0a66c2]">—</span>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-[#e0dfdc]">
          <div className="text-[11px] text-gray-500">{t('strengthenProfile')}</div>
          <button className="text-xs font-semibold mt-1 hover:underline">{t('tryPremium')}</button>
        </div>
        <Link to="/me" className="flex items-center gap-2 px-4 py-2 border-t border-[#e0dfdc] text-xs font-semibold text-gray-700 hover:bg-gray-100">
          <Bookmark className="w-4 h-4" />
          {t('myItems')}
        </Link>
      </div>

      <div className="li-card p-3 space-y-2">
        <button onClick={() => setCreateContentType('post')} className="w-full flex items-center gap-2 px-3 py-2 bg-[#0a66c2] text-white text-xs font-semibold rounded-full hover:bg-[#004182]">
          <MessageSquare className="w-4 h-4" /> {t('createPost')}
        </button>
        <button onClick={() => setCreateContentType('article')} className="w-full flex items-center gap-2 px-3 py-2 bg-[#e16745] text-white text-xs font-semibold rounded-full hover:bg-[#c85a35]">
          <FileText className="w-4 h-4" /> {t('writeArticle')}
        </button>
        <button onClick={() => setCreateContentType('event')} className="w-full flex items-center gap-2 px-3 py-2 bg-[#c37d16] text-white text-xs font-semibold rounded-full hover:bg-[#9d6410]">
          <CalendarDays className="w-4 h-4" /> {t('createEvent')}
        </button>
      </div>

      <div className="li-card p-3 text-xs">
        <Link to="/groups" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold">
          <span className="flex items-center gap-2"><Users className="w-4 h-4" /> {t('groups')}</span>
        </Link>
        <Link to="/events" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold mt-1">
          <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> {t('events')}</span>
          <Plus className="w-4 h-4" />
        </Link>
        <Link to="/hashtags" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold mt-1">
          <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> {t('followedHashtags')}</span>
        </Link>
        <Link to="/position-requests" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold mt-1">
          <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> {t('positionRequests')}</span>
        </Link>
        <div className="border-t border-[#e0dfdc] mt-2 pt-2 text-center font-semibold text-gray-600 hover:bg-gray-100 rounded py-1 cursor-pointer">
          {t('discoverMore')}
        </div>
      </div>
    </aside>
  );
}