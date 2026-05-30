import React, { useEffect } from 'react';
import LeftSidebar from '../components/LeftSidebar';
import RightSidebar from '../components/RightSidebar';
import CreatePost from '../components/CreatePost';
import CreateArticle from '../components/CreateArticle';
import CreateEvent from '../components/CreateEvent';
import PostCard from '../components/PostCard';
import { useApp } from '../context/AppContext';
import { Filter } from 'lucide-react';

export default function Feed() {
  const { posts } = useApp();

  useEffect(() => {
    const hash = window.location.hash?.slice(1);
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [posts]);
  
  if (!posts || !Array.isArray(posts)) {
    return (
      <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
        <p className="text-gray-600">Loading feed...</p>
      </div>
    );
  }
  
  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-3 sm:py-4 grid grid-cols-12 gap-3 sm:gap-6">
      <div className="hidden lg:block lg:col-span-3 sticky top-[68px] self-start">
        <LeftSidebar />
      </div>
      <div className="col-span-12 lg:col-span-6 space-y-1 sm:space-y-2">
        <CreatePost />
        <CreateArticle />
        <CreateEvent />
        <div className="flex items-center justify-end text-xs text-gray-600 px-1">
          <div className="flex-1 border-t border-gray-300 mr-2" />
          <button className="flex items-center gap-1 hover:text-[#0a66c2]">
            Sort by: <span className="font-semibold text-gray-800">Top</span> <Filter className="w-3 h-3" />
          </button>
        </div>
        {posts.length > 0 ? (
          posts.map((p) => {
            if (!p || !p.id) return null;
            return <PostCard key={p.id} post={p} />;
          })
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No posts yet. Start a conversation!</p>
          </div>
        )}
      </div>
      <div className="hidden lg:block lg:col-span-3 sticky top-[68px] self-start">
        <RightSidebar />
      </div>
    </div>
  );
}