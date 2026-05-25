import React, { useEffect, useState, memo } from 'react';
import * as PortalPrimitive from '@radix-ui/react-portal';
import { Link } from 'react-router-dom';
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  MoreHorizontal,
  Globe,
  Heart,
  Lightbulb,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import CommentBox from './CommentBox';
import ReportModal from './ReportModal';

function nFmt(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const REACTIONS = [
  { key: 'like', label: 'Like', Icon: ThumbsUp, color: 'text-[#0a66c2]' },
  { key: 'celebrate', label: 'Celebrate', Icon: Sparkles, color: 'text-amber-500' },
  { key: 'support', label: 'Support', Icon: Heart, color: 'text-rose-500' },
  { key: 'insightful', label: 'Insightful', Icon: Lightbulb, color: 'text-yellow-500' },
];

const PostCardComponent = ({ post }) => {
  const { toggleLike, commentsByPost, addComment, repostPost, user, deletePost, updatePost } = useApp();
  const [showComments, setShowComments] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [pop, setPop] = useState(false);
  const [showRepostMenu, setShowRepostMenu] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteText, setQuoteText] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [savingEdit, setSavingEdit] = useState(false);
  const comments = commentsByPost[post.id] || [];

  const onLike = () => {
    toggleLike(post.id);
    setPop(true);
    setTimeout(() => setPop(false), 300);
  };

  const onSimpleRepost = async () => {
    try { await repostPost(post.id, ''); setShowRepostMenu(false); } catch (e) {}
  };

  const onQuoteRepost = async () => {
    if (!quoteText.trim()) return;
    try { await repostPost(post.id, quoteText.trim()); setQuoteOpen(false); setQuoteText(''); } catch (e) {}
  };

  const isAuthor = user?.id === post.author?.id;

  const handleDelete = async () => {
    if (!window.confirm('هل أنت متأكد من حذف المنشور؟')) return;
    try {
      await deletePost(post.id);
      setShowMenu(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      await updatePost(post.id, { content: editContent.trim() });
      setEditOpen(false);
      setShowMenu(false);
    } catch (e) {
      console.error(e);
    }
    setSavingEdit(false);
  };

  useEffect(() => {
    setEditContent(post.content || '');
  }, [post.content]);

  if (!post) return null;
  
  const quoteModal = quoteOpen ? (
    <PortalPrimitive.Portal>
      <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setQuoteOpen(false)}>
        <div className="bg-white rounded-lg w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold mb-2">Add your thoughts</h3>
          <textarea autoFocus value={quoteText} onChange={(e) => setQuoteText(e.target.value)} rows={4}
            className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#0a66c2]" data-testid={`repost-quote-text-${post.id}`} />
          <div className="border border-gray-200 rounded p-2 mt-2 text-xs text-gray-600">↪ Reposting: "{(post.content || "").slice(0, 100)}..."</div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setQuoteOpen(false)} className="text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-gray-100">Cancel</button>
            <button onClick={onQuoteRepost} disabled={!quoteText.trim()} className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-sm font-semibold rounded-full px-5 py-1.5" data-testid={`repost-quote-submit-${post.id}`}>Post</button>
          </div>
        </div>
      </div>
    </PortalPrimitive.Portal>
  ) : null;
  
  const editModal = editOpen ? (
    <PortalPrimitive.Portal>
      <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={() => setEditOpen(false)}>
        <div className="bg-white rounded-lg w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="font-semibold mb-2">تعديل المنشور</h3>
          <textarea
            autoFocus
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={6}
            className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-[#0a66c2]"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setEditOpen(false)} className="text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-gray-100">إلغاء</button>
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit || !editContent.trim()}
              className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-sm font-semibold rounded-full px-5 py-1.5"
            >
              {savingEdit ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>
    </PortalPrimitive.Portal>
  ) : null;

  return (
    <>
      <article className="li-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-2 p-3 pb-2">
        <Link to={post.company_id ? `/company/${post.company_id}` : `/in/${post.author.id}`} className="shrink-0">
          <img src={post.author.avatar} alt={post.author.name} className="w-12 h-12 rounded-full object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={post.company_id ? `/company/${post.company_id}` : `/in/${post.author.id}`} className="text-sm font-semibold hover:text-[#0a66c2] hover:underline inline-flex items-center gap-1">
            <span translate="no">{post.author?.name || ''}</span>
            {post.author?.verified ? <CheckCircle2 className="w-4 h-4 text-[#0a66c2]" fill="#0a66c2" stroke="white" /> : null}
            <span className="text-xs text-gray-500 font-normal">· 1st</span>
          </Link>
          <p className="text-xs text-gray-600 line-clamp-1">{post.author.headline}</p>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
            <span translate="no">{post.timeAgo || ''}</span>
            <span>·</span>
            <Globe className="w-3 h-3" />
          </p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowReport(true)} className="text-gray-500 hover:bg-gray-100 rounded-full p-1" title="إبلاغ">
            <AlertCircle className="w-5 h-5" />
          </button>
          {isAuthor ? (
            <div className="relative">
              <button onClick={() => setShowMenu((s) => !s)} className="text-gray-500 hover:bg-gray-100 rounded-full p-1" title="خيارات المنشور">
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
                  <div onClick={() => { setEditOpen(true); setShowMenu(false); }} className="cursor-pointer text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">تعديل</div>
                  <div onClick={handleDelete} className="cursor-pointer text-right px-3 py-2 text-sm text-red-600 hover:bg-red-50">حذف</div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-2 text-sm whitespace-pre-wrap leading-relaxed"><span translate="no">{post.content || ''}</span></div>

      {post.image ? (
        <div className="bg-gray-100">
          <img src={post.image} alt="post" className="w-full max-h-[520px] object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </div>
      ) : null}

      {/* Reaction summary */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-600 border-b border-[#e0dfdc]">
        <div className="flex items-center gap-1">
          <div className="flex -space-x-1">
            <span className="w-4 h-4 rounded-full bg-[#0a66c2] flex items-center justify-center">
              <ThumbsUp className="w-2.5 h-2.5 text-white" fill="white" />
            </span>
            <span className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center">
              <Heart className="w-2.5 h-2.5 text-white" fill="white" />
            </span>
            <span className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-white" />
            </span>
          </div>
          <span className="hover:text-[#0a66c2] hover:underline cursor-pointer">{nFmt(post.likes)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="hover:text-[#0a66c2] hover:underline" onClick={() => setShowComments((s) => !s)}>
            {post.comments} comments
          </button>
          <span>· {post.reposts} reposts</span>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-stretch px-2 py-1 relative">
        <div
          className="relative flex-1"
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
        >
          <button
            onClick={onLike}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold hover:bg-gray-100 ${
              post.liked ? 'text-[#0a66c2]' : 'text-gray-600'
            }`}
          >
            <ThumbsUp className={`w-5 h-5 ${pop ? 'pop' : ''}`} fill={post.liked ? '#0a66c2' : 'none'} />
            Like
          </button>

          {showReactions && (
            <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-full shadow-lg flex items-center px-2 py-1 gap-1 z-20">
              {REACTIONS.map((r) => (
                <button
                  key={r.key}
                  onClick={onLike}
                  className={`p-2 rounded-full hover:scale-125 transition-transform ${r.color}`}
                  title={r.label}
                >
                  <r.Icon className="w-5 h-5" fill="currentColor" />
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold text-gray-600 hover:bg-gray-100"
        >
          <MessageSquare className="w-5 h-5" />
          Comment
        </button>
        <button onClick={() => setShowRepostMenu((s) => !s)} data-testid={`repost-btn-${post.id}`} className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold text-gray-600 hover:bg-gray-100 relative">
          <Repeat2 className="w-5 h-5" />
          Repost
          {showRepostMenu && (
            <div className="absolute right-0 bottom-12 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-20 w-56" onMouseLeave={() => setShowRepostMenu(false)} onClick={(e) => e.stopPropagation()}>
              <div onClick={onSimpleRepost} data-testid={`repost-simple-${post.id}`} className="text-left text-sm hover:bg-gray-100 rounded px-3 py-2 cursor-pointer">Repost</div>
              <div onClick={() => { setShowRepostMenu(false); setQuoteOpen(true); }} data-testid={`repost-quote-${post.id}`} className="text-left text-sm hover:bg-gray-100 rounded px-3 py-2 cursor-pointer">Repost with your thoughts</div>
            </div>
          )}
        </button>
        <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded text-sm font-semibold text-gray-600 hover:bg-gray-100">
          <Send className="w-5 h-5" />
          Send
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="px-4 pb-3 border-t border-[#e0dfdc] pt-3 space-y-3">
          <CommentBox onSubmit={(t) => addComment(post.id, t)} />
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2">
              <img src={c.author.avatar} alt={c.author.name} className="w-8 h-8 rounded-full object-cover" />
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-sm">{c.author.name}</span>
                    <span className="text-[11px] text-gray-500">{c.timeAgo}</span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-1">{c.author.headline}</p>
                  <p className="text-sm mt-1">{c.text}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1 px-2">
                  <button className="font-semibold hover:underline">Like</button>
                  <button className="font-semibold hover:underline">Reply</button>
                  {c.likes > 0 && <span>· {c.likes} likes</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      </article>
      {quoteModal}
      {editModal}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="post"
        targetId={post.id}
        targetName={post.company_id ? `${post.author?.name || 'Company'}'s post` : `${post.author?.name || 'User'}'s post`}
      />
    </>
  );
};

export default memo(
  PostCardComponent,
  (prev, next) =>
    prev.post.id === next.post.id &&
    prev.post.liked === next.post.liked &&
    prev.post.likes === next.post.likes &&
    prev.post.comments === next.post.comments &&
    prev.post.content === next.post.content &&
    prev.post.image === next.post.image
);