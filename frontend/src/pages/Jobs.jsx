import React, { useMemo, useState, useRef, useCallback } from 'react';
import { Bookmark, BookmarkCheck, Building2, MapPin, Search, Star, Zap, Briefcase, CheckCircle2, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ReportModal from '../components/ReportModal';
import { jobsApi } from '../api';
import { useEffect } from 'react';
import { toast } from 'sonner';
import CreateJobPostingModal from '../components/CreateJobPostingModal';
import CreateJobSeekerRequestModal from '../components/CreateJobSeekerRequestModal';

export default function Jobs() {
  const { savedJobs, appliedJobs, toggleSaveJob, applyJob } = useApp();
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [loc, setLoc] = useState('');
  const [isJobPostingModalOpen, setIsJobPostingModalOpen] = useState(false);
  const [isJobSeekerModalOpen, setIsJobSeekerModalOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef(null);
  const LIMIT = 12;

  const loadJobs = useCallback((isInitial = true) => {
    const setterFunc = isInitial ? setLoading : setLoadingMore;
    setterFunc(true);
    
    jobsApi.list(q, loc).then((data) => {
      const list = data || [];
      setSkip((prevSkip) => {
        const offset = isInitial ? 0 : prevSkip;
        if (isInitial) {
          setJobs(list.slice(0, LIMIT));
          setHasMore(list.length > LIMIT);
          if (!selected && list.length) setSelected(list[0].id);
        } else {
          setJobs((prev) => [...prev, ...list.slice(offset, offset + LIMIT)]);
          setHasMore(list.length > offset + LIMIT);
        }
        setterFunc(false);
        return isInitial ? LIMIT : prevSkip + LIMIT;
      });
    }).catch(() => {
      setterFunc(false);
      setJobs(isInitial ? [] : (prev) => prev);
    });
  }, [q, loc]);

  useEffect(() => {
    setSkip(0);
    setHasMore(true);
    loadJobs(true);
  }, [q, loc]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadJobs(false);
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadJobs]);

  const filtered = jobs || [];
  const job = filtered.find((j) => j.id === selected) || filtered[0];

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
      {/* Search bar */}
      <div className="li-card p-3 mb-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Title, skill or company"
            className="w-full h-9 bg-[#edf3f8] rounded pl-9 pr-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
          />
        </div>
        <div className="relative flex-1 min-w-[150px]">
          <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="City, state, or zip code"
            className="w-full h-9 bg-[#edf3f8] rounded pl-9 pr-3 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
          />
        </div>
        <button className="bg-[#0a66c2] hover:bg-[#004182] text-white text-sm font-semibold rounded-full px-4 h-9 whitespace-nowrap">Search</button>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsJobPostingModalOpen(true)}
            className="flex items-center gap-1 bg-[#0a66c2] text-white px-3 py-2 rounded-full text-sm font-semibold hover:bg-[#004182] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Post Job
          </button>
          <button
            onClick={() => setIsJobSeekerModalOpen(true)}
            className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-full text-sm font-semibold hover:bg-green-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Looking for Job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* List */}
        <div className="col-span-12 sm:col-span-6 md:col-span-5 lg:col-span-5 li-card overflow-hidden">
          <div className="px-3 sm:px-4 py-3 border-b border-[#e0dfdc] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold text-sm sm:text-base">Top job picks for you</h2>
              <p className="text-xs text-gray-600 mt-0.5 hidden sm:block">Based on your profile, preferences, and activity</p>
            </div>
            <span className="text-xs text-gray-500 shrink-0">{filtered.length}</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[50vh] sm:max-h-[75vh] overflow-y-auto">
            {filtered.map((j) => (
              <li
                key={j.id}
                onClick={() => setSelected(j.id)}
                className={`p-2 sm:p-3 cursor-pointer hover:bg-gray-50 ${selected === j.id ? 'bg-[#eaf3ff]' : ''}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <img src={j.logo} alt={j.company} onError={(ev) => (ev.target.style.display = 'none')} className="w-10 sm:w-12 h-10 sm:h-12 rounded object-contain bg-gray-50 border border-gray-100 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[#0a66c2] hover:underline font-semibold text-sm sm:text-[15px] leading-tight line-clamp-2">{j.title}</h3>
                    <p className="text-xs sm:text-sm truncate">{j.company}</p>
                    <p className="text-xs text-gray-600 truncate">{j.location}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] sm:text-[11px] text-gray-500 flex-wrap">
                      {j.promoted && <span className="shrink-0">Promoted</span>}
                      {j.easyApply && (
                        <span className="flex items-center gap-0.5 text-gray-700 font-semibold shrink-0"><Zap className="w-3 h-3 text-[#0a66c2]" /> Easy Apply</span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 mt-0.5 line-clamp-1">{j.postedAgo} · {j.applicants} applicants</p>
                    {appliedJobs.has(j.id) && (
                      <p className="text-[10px] sm:text-[11px] text-green-700 mt-1 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Applied</p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSaveJob(j.id);
                    }}
                    className="text-gray-500 hover:bg-gray-200 rounded-full p-1"
                  >
                    {savedJobs.has(j.id) ? <BookmarkCheck className="w-5 h-5 text-[#0a66c2]" /> : <Bookmark className="w-5 h-5" />}
                  </button>
                </div>
              </li>
            ))}
            <div ref={loadMoreRef} className="py-4 text-center">
              {loadingMore && (
                <div className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-500">Loading more jobs…</span>
                </div>
              )}
            </div>
          </ul>
        </div>

        {/* Detail */}
        <div className="col-span-12 sm:col-span-6 md:col-span-7 lg:col-span-7 li-card overflow-hidden">
          {job ? (
            <>
              <div className="p-4 sm:p-5 border-b border-[#e0dfdc]">
                <div className="flex items-center gap-2 sm:gap-3">
                  <img src={job.logo} alt={job.company} onError={(ev) => (ev.target.style.display = 'none')} className="w-10 sm:w-12 h-10 sm:h-12 rounded object-contain bg-gray-50 border border-gray-100 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm truncate">{job.company}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1 truncate"><Building2 className="w-3 h-3 shrink-0" /> Software · 5K-10K</p>
                  </div>
                </div>
                <h1 className="text-lg sm:text-2xl font-bold mt-3 leading-tight line-clamp-2">{job.title}</h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 line-clamp-1">{job.location} · {job.postedAgo}</p>
                <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-gray-700 flex-wrap">
                  <span className="flex items-center gap-1"><Briefcase className="w-3 sm:w-4 h-3 sm:h-4" /> {job.type}</span>
                  <span>·</span>
                  <span className="font-semibold">{job.salary}</span>
                </div>
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <button
                    onClick={() => {
                      applyJob(job.id);
                      toast.success(`Application submitted to ${job.company}`);
                    }}
                    disabled={appliedJobs.has(job.id)}
                    className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-xs sm:text-sm font-semibold rounded-full px-3 sm:px-5 py-1.5 flex items-center gap-1 shrink-0"
                  >
                    {appliedJobs.has(job.id) ? (<><CheckCircle2 className="w-3 sm:w-4 h-3 sm:h-4" /> Applied</>) : (<><Zap className="w-3 sm:w-4 h-3 sm:h-4" /> Apply</>)}
                  </button>
                  <button
                    onClick={() => toggleSaveJob(job.id)}
                    className="border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 text-xs sm:text-sm font-semibold rounded-full px-3 sm:px-5 py-1.5 shrink-0"
                  >
                    {savedJobs.has(job.id) ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    className="border border-red-500 text-red-600 hover:bg-red-50 text-xs sm:text-sm font-semibold rounded-full px-3 sm:px-4 py-1.5 flex items-center gap-1 shrink-0"
                  >
                    <AlertCircle className="w-3 sm:w-4 h-3 sm:h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 overflow-y-auto max-h-[40vh] sm:max-h-none">
                <h2 className="font-semibold text-sm sm:text-base mb-2">About the job</h2>
                <p className="text-xs sm:text-sm leading-relaxed line-clamp-6 sm:line-clamp-none">{job.description}</p>
                <h3 className="font-semibold text-xs sm:text-sm mt-4 mb-2">Skills</h3>
                <div className="flex flex-wrap gap-1 sm:gap-2">
                  {(job.skills || []).slice(0, 5).map((s) => (
                    <span key={s} className="text-xs bg-gray-100 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full line-clamp-1">{s}</span>
                  ))}
                  {(job.skills || []).length > 5 && <span className="text-xs text-gray-600 px-2 py-0.5">+{(job.skills || []).length - 5} more</span>}
                </div>

                <h3 className="font-semibold text-xs sm:text-sm mt-4 mb-2 flex items-center gap-1"><Star className="w-3 sm:w-4 h-3 sm:h-4 text-amber-500 shrink-0" /> Why Match</h3>
                <ul className="text-xs sm:text-sm space-y-1 list-disc pl-4 text-gray-700">
                  <li className="line-clamp-1">You have 5 of the top 6 skills.</li>
                  <li className="line-clamp-1">Located in {(job.location || '').split(',')[0]}.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-xs sm:text-sm text-gray-500">Select a job to see details.</div>
          )}
        </div>
      </div>

      <CreateJobPostingModal
        isOpen={isJobPostingModalOpen}
        onClose={() => setIsJobPostingModalOpen(false)}
        onSuccess={loadJobs}
      />

      <CreateJobSeekerRequestModal
        isOpen={isJobSeekerModalOpen}
        onClose={() => setIsJobSeekerModalOpen(false)}
        onSuccess={loadJobs}
      />

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="job"
        targetId={job?.id}
        targetName={job?.title}
      />
    </div>
  );
}