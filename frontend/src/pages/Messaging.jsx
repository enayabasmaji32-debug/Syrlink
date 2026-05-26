import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Search, Send, MoreHorizontal, Edit3, ChevronDown, Smile, Paperclip, Image } from 'lucide-react';
import { toast } from 'sonner';
import { messagesApi } from '../api';

export default function Messaging() {
  const { userId } = useParams();
  const { conversations, sendMessage, user, loadThread } = useApp();
  const [activeId, setActiveId] = useState(null);
  const [localConversations, setLocalConversations] = useState([]);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync local state with global conversations
  React.useEffect(() => {
    setLocalConversations(conversations);
  }, [conversations]);

  // When userId param changes, find or create conversation - SEPARATED from localConversations dependency
  React.useEffect(() => {
    if (userId) {
      // Try to find existing conversation with this user using the global conversations
      const existing = conversations.find((c) => c.user?.id === userId || c.other_user_id === userId);
      if (existing) {
        setActiveId(existing.id);
      } else {
        // Create new conversation with this user
        setLoading(true);
        messagesApi.start(userId)
          .then((conv) => {
            // Immediately set the conversation as active since backend now returns full user info
            setActiveId(conv.id);
            console.log('[Messaging] New conversation created:', conv.id, 'with user:', conv.user?.id);
          })
          .catch((err) => {
            console.error('Failed to start conversation:', err);
            toast.error('Failed to open conversation');
          })
          .finally(() => setLoading(false));
      }
    } else if (!activeId && conversations.length) {
      // Default to first conversation if no userId specified
      setActiveId(conversations[0]?.id);
    }
  }, [userId]); // Only depend on userId changes, not localConversations

  React.useEffect(() => {
    if (activeId && localConversations.length > 0) {
      const conv = localConversations.find((c) => c.id === activeId);
      if (conv && !conv.thread) {
        loadThread(activeId);
      }
    }
  }, [activeId, localConversations]);

  // Get the active conversation - if activeId is set but not found, use a placeholder instead of defaulting to first
  const active = localConversations.find((c) => c.id === activeId);
  
  if (!active && activeId && localConversations.length > 0) {
    // This handles the case where activeId is set but conversation isn't in the list yet
    // (e.g., newly created conversation that haven't been synced back from server)
    console.log('[Messaging] Active conversation with ID', activeId, 'not found in list, may still be loading');
  }

  const filtered = localConversations.filter((c) => c.user?.name?.toLowerCase().includes(q.toLowerCase()));

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
      <div className="li-card overflow-hidden grid grid-cols-12 h-[60vh] sm:h-[80vh]">
        {/* Left: Conversation list */}
        <div className="col-span-12 md:col-span-4 border-r border-[#e0dfdc] flex flex-col">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-[#e0dfdc]">
            <h2 className="font-semibold text-sm sm:text-base flex items-center gap-1">Messaging <ChevronDown className="w-3 sm:w-4 h-3 sm:h-4" /></h2>
            <div className="flex items-center gap-1">
              <button className="p-1 sm:p-1.5 rounded-full hover:bg-gray-100"><MoreHorizontal className="w-4 sm:w-5 h-4 sm:h-5" /></button>
              <button className="p-1 sm:p-1.5 rounded-full hover:bg-gray-100"><Edit3 className="w-4 sm:w-5 h-4 sm:h-5" /></button>
            </div>
          </div>
          <div className="px-2 sm:px-3 py-2 border-b border-[#e0dfdc]">
            <div className="relative">
              <Search className="w-3 sm:w-4 h-3 sm:h-4 absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search messages"
                className="w-full h-7 sm:h-8 bg-[#edf3f8] rounded pl-8 sm:pl-9 pr-2 sm:pr-3 text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
              />
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filtered.map((c) => (
              <li
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`px-2 sm:px-3 py-2 sm:py-3 cursor-pointer hover:bg-gray-50 flex items-start gap-2 ${activeId === c.id ? 'bg-[#eaf3ff]' : ''}`}
              >
                <div className="relative shrink-0">
                  <img src={c.user.avatar} alt={c.user.name} className="w-10 sm:w-12 h-10 sm:h-12 rounded-full object-cover" />
                  {c.online && <span className="absolute bottom-0 right-0 w-2 sm:w-3 h-2 sm:h-3 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1 sm:gap-2">
                    <span className={`text-xs sm:text-sm truncate ${c.unread ? 'font-bold' : 'font-semibold'}`}>{c.user.name}</span>
                    <span className="text-[10px] sm:text-[11px] text-gray-500 whitespace-nowrap shrink-0">{c.timeAgo}</span>
                  </div>
                  <p className={`text-xs truncate ${c.unread ? 'text-gray-900 font-semibold' : 'text-gray-600'}`}>{c.lastMessage}</p>
                </div>
                {c.unread && <span className="w-2 h-2 rounded-full bg-[#0a66c2] mt-2 shrink-0" />}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="p-4 sm:p-6 text-center text-xs sm:text-sm text-gray-500">No conversations found.</li>
            )}
          </ul>
        </div>

        {/* Right: Active conversation */}
        <div className="hidden md:flex md:col-span-8 flex-col">
          {active ? (
            <>
              <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-[#e0dfdc] flex items-center gap-2 sm:gap-3">
                <img src={active.user.avatar} alt={active.user.name} className="w-8 sm:w-9 h-8 sm:h-9 rounded-full object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold truncate">{active.user.name}</p>
                  <p className="text-xs text-gray-600 line-clamp-1">{active.user.headline}</p>
                </div>
                <button className="p-1 sm:p-1.5 rounded-full hover:bg-gray-100 shrink-0"><MoreHorizontal className="w-4 sm:w-5 h-4 sm:h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-2 sm:py-3 space-y-3 bg-white">
                <div className="text-center text-[10px] sm:text-[11px] text-gray-500">Today</div>
                {(active.thread || []).map((m) => (
                  <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'} gap-1 sm:gap-2 items-end`}>
                    {m.from !== 'me' && <img src={active.user.avatar} alt={active.user.name} className="w-5 sm:w-7 h-5 sm:h-7 rounded-full object-cover shrink-0" />}
                    <div className="max-w-[70%]">
                      <div className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-2xl text-xs sm:text-sm leading-relaxed ${m.from === 'me' ? 'bg-[#0a66c2] text-white rounded-br-md' : 'bg-gray-100 text-gray-900 rounded-bl-md'}`}>
                        {m.text}
                      </div>
                      <p className={`text-[9px] sm:text-[10px] text-gray-500 mt-1 ${m.from === 'me' ? 'text-right' : 'text-left'}`}>{m.time}</p>
                    </div>
                    {m.from === 'me' && <img src={user.avatar} alt="you" className="w-5 sm:w-7 h-5 sm:h-7 rounded-full object-cover shrink-0" />}
                  </div>
                ))}
              </div>
              <div className="border-t border-[#e0dfdc] p-2 sm:p-3">
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
                    className="w-full p-2 sm:p-3 text-xs sm:text-sm resize-none focus:outline-none rounded-lg"
                  />
                  <div className="flex items-center justify-between px-1 sm:px-2 pb-1 sm:pb-2">
                    <div className="flex items-center gap-1 text-gray-600">
                      <button className="p-1 sm:p-1.5 rounded hover:bg-gray-100"><Image className="w-4 sm:w-5 h-4 sm:h-5" /></button>
                      <button className="p-1 sm:p-1.5 rounded hover:bg-gray-100"><Paperclip className="w-4 sm:w-5 h-4 sm:h-5" /></button>
                      <button className="p-1 sm:p-1.5 rounded hover:bg-gray-100"><Smile className="w-4 sm:w-5 h-4 sm:h-5" /></button>
                    </div>
                    <button
                      onClick={submit}
                      disabled={!text.trim()}
                      className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-xs sm:text-sm font-semibold rounded px-3 sm:px-4 py-1 flex items-center gap-1"
                    >
                      <Send className="w-3 sm:w-4 h-3 sm:h-4" />
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs sm:text-sm">
              {loading ? 'Opening conversation...' : 'Select a conversation to start chatting.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}