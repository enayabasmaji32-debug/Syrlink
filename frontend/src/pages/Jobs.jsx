import React, { useMemo, useState } from 'react';
import { Bookmark, BookmarkCheck, Building2, MapPin, Search, Star, Zap, Briefcase, CheckCircle2, Plus, AlertCircle } from 'lucide-react';
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

  const loadJobs = () => {
    jobsApi.list(q, loc).then((data) => {
      const list = data || [];
      setJobs(list);
      if (!selected && list.length) setSelected(list[0].id);
    }).catch(() => setJobs([]));
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line
  }, [q, loc]);

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
        <div className="col-span-12 md:col-span-5 li-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e0dfdc] flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">Top job picks for you</h2>
              <p className="text-xs text-gray-600 mt-0.5">Based on your profile, preferences, and activity</p>
            </div>
            <span className="text-xs text-gray-500">{filtered.length} results</span>
          </div>
          <ul className="divide-y divide-gray-100 max-h-[75vh] overflow-y-auto">
            {filtered.map((j) => (
              <li
                key={j.id}
                onClick={() => setSelected(j.id)}
                className={`p-3 cursor-pointer hover:bg-gray-50 ${selected === j.id ? 'bg-[#eaf3ff]' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <img src={j.logo} alt={j.company} onError={(ev) => (ev.target.style.display = 'none')} className="w-12 h-12 rounded object-contain bg-gray-50 border border-gray-100" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[#0a66c2] hover:underline font-semibold text-[15px] leading-tight line-clamp-2">{j.title}</h3>
                    <p className="text-sm">{j.company}</p>
                    <p className="text-xs text-gray-600">{j.location}</p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                      {j.promoted && <span>Promoted</span>}
                      {j.easyApply && (
                        <span className="flex items-center gap-0.5 text-gray-700 font-semibold"><Zap className="w-3 h-3 text-[#0a66c2]" /> Easy Apply</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{j.postedAgo} · {j.applicants} applicants</p>
                    {appliedJobs.has(j.id) && (
                      <p className="text-[11px] text-green-700 mt-1 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Applied</p>
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
          </ul>
        </div>

        {/* Detail */}
        <div className="col-span-12 md:col-span-7 li-card overflow-hidden">
          {job ? (
            <>
              <div className="p-5 border-b border-[#e0dfdc]">
                <div className="flex items-center gap-3">
                  <img src={job.logo} alt={job.company} onError={(ev) => (ev.target.style.display = 'none')} className="w-12 h-12 rounded object-contain bg-gray-50 border border-gray-100" />
                  <div>
                    <p className="font-semibold text-sm">{job.company}</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1"><Building2 className="w-3 h-3" /> Software · 5,001-10,000 employees</p>
                  </div>
                </div>
                <h1 className="text-2xl font-bold mt-3 leading-tight">{job.title}</h1>
                <p className="text-sm text-gray-600 mt-1">{job.location} · {job.postedAgo} · {job.applicants} applicants</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-700">
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {job.type}</span>
                  <span>·</span>
                  <span className="font-semibold">{job.salary}</span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      applyJob(job.id);
                      toast.success(`Application submitted to ${job.company}`);
                    }}
                    disabled={appliedJobs.has(job.id)}
                    className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-sm font-semibold rounded-full px-5 py-1.5 flex items-center gap-1"
                  >
                    {appliedJobs.has(job.id) ? (<><CheckCircle2 className="w-4 h-4" /> Applied</>) : (<><Zap className="w-4 h-4" /> Easy Apply</>)}
                  </button>
                  <button
                    onClick={() => toggleSaveJob(job.id)}
                    className="border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 text-sm font-semibold rounded-full px-5 py-1.5"
                  >
                    {savedJobs.has(job.id) ? 'Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    className="border border-red-500 text-red-600 hover:bg-red-50 text-sm font-semibold rounded-full px-4 py-1.5 flex items-center gap-1"
                  >
                    <AlertCircle className="w-4 h-4" /> Report
                  </button>
                </div>
              </div>

              <div className="p-5">
                <h2 className="font-semibold text-base mb-2">About the job</h2>
                <p className="text-sm leading-relaxed">{job.description}</p>
                <h3 className="font-semibold text-sm mt-4 mb-2">Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {(job.skills || []).map((s) => (
                    <span key={s} className="text-xs bg-gray-100 px-2.5 py-1 rounded-full">{s}</span>
                  ))}
                </div>

                <h3 className="font-semibold text-sm mt-4 mb-2 flex items-center gap-1"><Star className="w-4 h-4 text-amber-500" /> Why this is a great match</h3>
                <ul className="text-sm space-y-1 list-disc pl-5 text-gray-700">
                  <li>You have 5 of the top 6 skills they're looking for.</li>
                  <li>You're located in or near {(job.location || '').split(',')[0]}.</li>
                  <li>Your seniority matches the role expectations.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="p-10 text-center text-sm text-gray-500">Select a job to see details.</div>
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