import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Send } from 'lucide-react';

export default function CommentBox({ onSubmit }) {
  const { user } = useApp();
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSubmit(t);
    setText('');
  };

  return (
    <div className="flex gap-2 items-start">
      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
      <div className="flex-1 relative">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Add a comment…"
          className="w-full border border-gray-300 rounded-full px-4 py-2 pr-12 text-sm focus:outline-none focus:border-[#0a66c2] focus:ring-2 focus:ring-[#0a66c2]/20"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-[#0a66c2] hover:bg-[#0a66c2]/10 disabled:text-gray-400 disabled:hover:bg-transparent"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}