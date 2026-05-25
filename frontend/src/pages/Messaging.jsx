import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Send, MoreHorizontal, Edit3, ChevronDown, Smile, Paperclip, Image } from 'lucide-react';
import { toast } from 'sonner';

export default function Messaging() {
  const { conversations, sendMessage, user, loadThread } = useApp();
  const [activeId, setActiveId] = useState(conversations[0]?.id);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');

  React.useEffect(() => {
    if (!activeId && conversations.length) setActiveId(conversations[0].id);
  }, [conversations, activeId]);

  React.useEffect(() => {
    if (activeId) {
      const conv = conversations.find((c) => c.id === activeId);
      if (conv && !conv.thread) loadThread(activeId);
    }
    // eslint-disable-next-line
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId) || conversations[0];

  const filtered = conversations.filter((c) => c.user.name.toLowerCase().includes(q.toLowerCase()));

  const submit = async () => {
    const t = text.trim();
    if (!t || !active) return;
    try {
      console.log('[Messaging] Sending message to', active.id, ':', t);
      await sendMessage(active.id, t);
      setText('');
      toast.success('Message sent');
    } catch (e) {
      console.error('[Messaging] Send error:', e?.response?.status, e?.response?.data, e?.message);
      const errorMsg = e?.response?.data?.detail || e?.message || 'Failed to send message';
      toast.error(errorMsg);
    }
  };

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
      <div className="li-card overflow-hidden grid grid-cols-12 h-[80vh]">
        {/* Left: Conversation list */}
        <div className="col-span-12 md:col-span-4 border-r border-[#e0dfdc] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0dfdc]">
            <h2 className="font-semibold flex items-center gap-1">Messaging <ChevronDown className="w-4 h-4" /></h2>
            <div className="flex items-center gap-1">
              <button className="p-1.5 rounded-full hover:bg-gray-100"><MoreHorizontal className="w-5 h-5" /></button>
              <button className="p-1.5 rounded-full hover:bg-gray-100"><Edit3 className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-[#e0dfdc]">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages"
                className="w-full h-8 bg-[#edf3f8] rounded pl-9 pr-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((c) => (
              <li
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`px-3 py-3 cursor-pointer hover:bg-gray-50 flex items-start gap-2 ${activeId === c.id ? 'bg-[#eaf3ff]' : ''}`}
              >
                <div className="relative">
                  <img src={c.user.avatar} alt={c.user.name} className="w-12 h-12 rounded-full object-cover" />
                  {c.online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-sm truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.user.name}</span>
                    <span className="text-[11px] text-gray-500 whitespace-nowrap">{c.timeAgo}</span>
                  </div>
                  <p className={`text-xs truncate ${c.unread ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{c.lastMessage}</p>
                </div>
                {c.unread && <span className="w-2 h-2 rounded-full bg-[#0a66c2] mt-2 shrink-0" />}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="p-6 text-center text-sm text-gray-500">No conversations found.</li>
            )}
          </ul>
        </div>

        {/* Right: Active conversation */}
        <div className="hidden md:flex md:col-span-8 flex-col">
          {active ? (
            <>
              <div className="px-4 py-3 border-b border-[#e0dfdc] flex items-center gap-3">
                <img src={active.user.avatar} alt={active.user.name} className="w-9 h-9 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{active.user.name}</p>
                  <p className="text-xs text-gray-600 line-clamp-1">{active.user.headline}</p>
                </div>
                <button className="p-1.5 rounded-full hover:bg-gray-100"><MoreHorizontal className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-white">
                <div className="text-center text-[11px] text-gray-500">Today</div>
                {(active.thread || []).map((m) => (
                  <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'} gap-2 items-end`}>
                    {m.from !== 'me' && <img src={active.user.avatar} alt={active.user.name} className="w-7 h-7 rounded-full object-cover" />}
                    <div className="max-w-[70%]">
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${m.from === 'me' ? 'bg-[#0a66c2] text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                        {m.text}
                      </div>
                      <p className={`text-[10px] text-gray-500 mt-1 ${m.from === 'me' ? 'text-right' : 'text-left'}`}>{m.time}</p>
                    </div>
                    {m.from === 'me' && <img src={user.avatar} alt="you" className="w-7 h-7 rounded-full object-cover" />}
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e0dfdc] p-3">
                <div className="border border-gray-300 rounded-lg focus-within:border-[#0a66c2] focus-within:ring-2 focus-within:ring-[#0a66c2]/20">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    placeholder="Write a message…"
                    rows={2}
                    className="w-full p-3 text-sm resize-none focus:outline-none rounded-lg"
                  />
                  <div className="flex items-center justify-between px-2 pb-2">
                    <div className="flex items-center gap-1 text-gray-600">
                      <button className="p-1.5 rounded hover:bg-gray-100"><Image className="w-5 h-5" /></button>
                      <button className="p-1.5 rounded hover:bg-gray-100"><Paperclip className="w-5 h-5" /></button>
                      <button className="p-1.5 rounded hover:bg-gray-100"><Smile className="w-5 h-5" /></button>
                    </div>
                    <button
                      onClick={submit}
                      disabled={!text.trim()}
                      className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-sm font-semibold rounded px-4 py-1 flex items-center gap-1"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Select a conversation to start chatting.</div>
          )}
        </div>
      </div>
    </div>
  );
}