import React from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Users, Plus, Hash, Mail } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function LeftSidebar() {
  const { user } = useApp();
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
            <span className="text-gray-600">Profile viewers</span>
            <span className="font-semibold text-[#0a66c2]">—</span>
          </div>
          <div className="flex justify-between hover:bg-gray-100 rounded px-1 py-1 cursor-pointer">
            <span className="text-gray-600">Post impressions</span>
            <span className="font-semibold text-[#0a66c2]">—</span>
          </div>
        </div>
        <div className="px-4 py-2 border-t border-[#e0dfdc]">
          <div className="text-[11px] text-gray-500">Strengthen your profile with an AI writing assistant</div>
          <button className="text-xs font-semibold mt-1 hover:underline">Try Premium for $0</button>
        </div>
        <Link to="/me" className="flex items-center gap-2 px-4 py-2 border-t border-[#e0dfdc] text-xs font-semibold text-gray-700 hover:bg-gray-100">
          <Bookmark className="w-4 h-4" />
          My items
        </Link>
      </div>

      <div className="li-card p-3 text-xs">
        <Link to="/groups" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold">
          <span className="flex items-center gap-2"><Users className="w-4 h-4" /> Groups</span>
        </Link>
        <Link to="/events" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold mt-1">
          <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Events</span>
          <Plus className="w-4 h-4" />
        </Link>
        <Link to="/hashtags" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold mt-1">
          <span className="flex items-center gap-2"><Hash className="w-4 h-4" /> Followed Hashtags</span>
        </Link>
        <Link to="/position-requests" className="flex items-center justify-between px-1 py-1 text-gray-600 hover:text-[#0a66c2] font-semibold mt-1">
          <span className="flex items-center gap-2"><Mail className="w-4 h-4" /> Position Requests</span>
        </Link>
        <div className="border-t border-[#e0dfdc] mt-2 pt-2 text-center font-semibold text-gray-600 hover:bg-gray-100 rounded py-1 cursor-pointer">
          Discover more
        </div>
      </div>
    </aside>
  );
}