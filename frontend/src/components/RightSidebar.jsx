import React, { useEffect, useState } from 'react';
import { Plus, Info } from 'lucide-react';
import { newsApi } from '../api';

export default function RightSidebar() {
  const [news, setNews] = useState([]);
  useEffect(() => {
    // Delay news loading to after main content is rendered
    const timer = setTimeout(() => {
      newsApi.list().then(setNews).catch(() => setNews([]));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <aside className="space-y-2">
      <div className="li-card p-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">SyrLink News</h3>
          <Info className="w-4 h-4 text-gray-500" />
        </div>
        <p className="text-xs text-gray-600">Top stories</p>
        <ul className="mt-2 space-y-2">
          {news.map((n) => (
            <li key={n.id} className="text-sm cursor-pointer hover:bg-gray-50 rounded px-1 py-1">
              <p className="font-semibold leading-tight">• {n.title}</p>
              <p className="text-[11px] text-gray-500 ml-2">{n.meta}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="li-card p-3 text-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Today's puzzles</h3>
        </div>
        <div className="flex items-center gap-2 mt-2 text-gray-700">
          <span className="w-8 h-8 rounded bg-amber-100 grid place-items-center">🧩</span>
          <div>
            <p className="font-semibold">Daily Pinpoint</p>
            <p className="text-gray-600 text-[11px]">Guess the category</p>
          </div>
        </div>
      </div>

      <div className="li-card p-3 text-center text-xs text-gray-500">
        <button className="inline-flex items-center gap-1 hover:bg-gray-100 rounded px-2 py-1 font-semibold text-gray-600">
          <Plus className="w-3 h-3" /> Promote your business
        </button>
      </div>
    </aside>
  );
}
