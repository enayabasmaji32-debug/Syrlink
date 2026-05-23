import React, { useState } from 'react';
import { Bell, Briefcase, Gift, MessageSquare, Settings, ThumbsUp, UserPlus, AtSign, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const TYPE_META = {
  like: { Icon: ThumbsUp, color: 'bg-[#0a66c2]/10 text-[#0a66c2]' },
  comment: { Icon: MessageSquare, color: 'bg-amber-100 text-amber-700' },
  connection: { Icon: UserPlus, color: 'bg-green-100 text-green-700' },
  mention: { Icon: AtSign, color: 'bg-purple-100 text-purple-700' },
  job: { Icon: Briefcase, color: 'bg-blue-100 text-blue-700' },
  job_application: { Icon: Briefcase, color: 'bg-indigo-100 text-indigo-700' },
  application_accepted: { Icon: Briefcase, color: 'bg-green-100 text-green-700' },
  application_rejected: { Icon: XCircle, color: 'bg-red-100 text-red-700' },
  birthday: { Icon: Gift, color: 'bg-rose-100 text-rose-700' },
  report_rejected: { Icon: XCircle, color: 'bg-red-100 text-red-700' },
};

const FILTERS = ['All', 'My posts', 'Mentions', 'Jobs'];

export default function Notifications() {
  const { notifications, markNotificationRead, user } = useApp();
  const [filter, setFilter] = useState('All');

  const filtered = notifications.filter((n) => {
    if (filter === 'All') return true;
    if (filter === 'Mentions') return n.type === 'mention';
    if (filter === 'Jobs') return n.type === 'job';
    if (filter === 'My posts') return n.type === 'like' || n.type === 'comment';
    return true;
  });

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4 grid grid-cols-12 gap-6">
      {/* Left rail */}
      <aside className="hidden lg:block lg:col-span-3 space-y-2">
        <div className="li-card overflow-hidden">
          <div className="h-14 bg-cover bg-center" style={{ backgroundImage: `url(${user.cover})` }} />
          <div className="px-4 pb-3 -mt-7 text-center">
            <img src={user.avatar} alt={user.name} className="w-16 h-16 rounded-full border-2 border-white object-cover mx-auto" />
            <p className="font-semibold mt-2 text-sm">{user.name}</p>
            <p className="text-xs text-gray-600 line-clamp-2">{user.headline}</p>
          </div>
        </div>
        <div className="li-card p-4 text-sm">
          <h3 className="font-semibold flex items-center gap-1 mb-2"><Settings className="w-4 h-4" /> Manage your notifications</h3>
          <p className="text-xs text-gray-600">View settings</p>
        </div>
      </aside>

      {/* Center */}
      <div className="col-span-12 lg:col-span-9 space-y-2">
        <div className="li-card p-3 flex items-center gap-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-sm font-semibold rounded-full px-3 py-1.5 whitespace-nowrap ${
                filter === f ? 'bg-[#01754f] text-white border border-[#01754f]' : 'border border-gray-400 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="li-card overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <li className="p-8 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
                <Bell className="w-8 h-8 text-gray-300" />
                You're all caught up!
              </li>
            )}
            {filtered.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.like;
              return (
                <li
                  key={n.id}
                  onClick={() => markNotificationRead(n.id)}
                  className={`p-4 flex items-start gap-3 cursor-pointer hover:bg-gray-50 ${!n.read ? 'bg-[#eaf3ff]' : ''}`}
                >
                  <div className="relative shrink-0">
                    <img src={n.actor.avatar} alt={n.actor.name} className="w-12 h-12 rounded-full object-cover" />
                    <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center ${meta.color} border-2 border-white`}>
                      <meta.Icon className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{n.actor.name}</span> <span className="text-gray-700">{n.text}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.timeAgo}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-[#0a66c2] mt-2 shrink-0" />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}