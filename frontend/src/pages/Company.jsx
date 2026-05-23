import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Globe,
  Briefcase,
  Users,
  AlertCircle,
  Plus,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import ReportModal from '../components/ReportModal';
import CreateJobPostingModal from '../components/CreateJobPostingModal';
import CreatePost from '../components/CreatePost';
import PostCard from '../components/PostCard';
import PositionRequestsList from '../components/PositionRequestsList';
import { companiesApi, jobsApi, postsApi } from '../api';

export default function Company() {
  const { companyId } = useParams();
  const { user, setActiveCompany } = useApp();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [isJobPostingModalOpen, setIsJobPostingModalOpen] = useState(false);
  const showInvestmentSection = Boolean(
    company?.is_looking_for_investors ||
    company?.valuation != null ||
    company?.funding_amount != null ||
    company?.available_equity != null ||
    company?.investment_type ||
    company?.company_status ||
    company?.funding_round_status
  );

  useEffect(() => {
    if (companyId) {
      companiesApi.get(companyId)
        .then(setCompany)
        .catch(() => setCompany(null))
        .finally(() => setLoading(false));
    }
  }, [companyId]);

  // Auto-select company for posting if user owns it
  useEffect(() => {
    if (company && (user?.is_admin || user?.id === company.user_id)) {
      setActiveCompany(company.id);
    }
  }, [company, user, setActiveCompany]);

  useEffect(() => {
    if (!company) {
      setJobs([]);
      setJobsLoading(false);
      setPosts([]);
      setPostsLoading(false);
      return;
    }

    setJobsLoading(true);
    jobsApi.getCompanyPostings(company.id)
      .then((data) => setJobs(data || []))
      .catch(() => setJobs([]))
      .finally(() => setJobsLoading(false));

    // Load company posts
    setPostsLoading(true);
    postsApi.list(null, company.id)
      .then((res) => setPosts(res.items || []))
      .catch(() => setPosts([]))
      .finally(() => setPostsLoading(false));
  }, [company]);

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!company) return <div className="text-center py-10">Company not found</div>;

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4 grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 space-y-4">
        {/* Cover & Header */}
        <section className="li-card overflow-hidden">
          <div
            className="h-48 bg-cover bg-center"
            style={{ backgroundImage: `url(${company.cover})` }}
          />
          <div className="px-6 pb-6 -mt-20">
            <div className="flex items-end justify-between gap-2">
              <img
                src={company.logo}
                alt={company.name}
                className="w-32 h-32 rounded-lg border-4 border-white object-cover bg-white"
              />
              <div className="flex flex-col gap-2">
                {(user?.is_admin || user?.id === company.user_id) && (
                  <Link
                    to={`/company/${company.id}/edit`}
                    className="inline-flex items-center justify-center px-4 py-2 bg-[#0a66c2] text-white rounded-full text-sm font-semibold hover:bg-[#004182] transition"
                  >
                    Edit Company
                  </Link>
                )}
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-red-500 text-red-600 hover:bg-red-50 font-semibold text-sm rounded-full transition"
                >
                  <AlertCircle className="w-4 h-4" /> Report
                </button>
              </div>
            </div>
            <div className="mt-4">
              <h1 className="text-3xl font-bold">{company.name}</h1>
              {company.is_looking_for_investors && (
                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-amber-100 border border-amber-300 rounded-full">
                  <TrendingUp className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">الشركة تبحث عن مستثمرين</span>
                </div>
              )}
              <p className="text-gray-600 text-lg mt-1">{company.tagline}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" /> {company.location}
                </div>
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" /> {company.industry}
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" /> {company.employees_count} employees
                </div>
                {company.website && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-[#0a66c2] hover:underline">
                      Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Investment Information */}
        {showInvestmentSection && (
          <section className="li-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-amber-600" />
              <h2 className="text-lg font-bold">معلومات الاستثمار</h2>
              {company.is_looking_for_investors && (
                <span className="ml-auto px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-xs font-semibold text-amber-700">
                  🔍 تبحث عن مستثمرين
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {company.valuation != null && (
                <div>
                  <p className="text-gray-500 font-medium">تقييم الشركة</p>
                  <p className="font-semibold">${company.valuation?.toLocaleString()}</p>
                </div>
              )}
              {company.funding_amount != null && (
                <div>
                  <p className="text-gray-500 font-medium">التمويل المطلوب</p>
                  <p className="font-semibold">${company.funding_amount?.toLocaleString()}</p>
                </div>
              )}
              {company.available_equity != null && (
                <div>
                  <p className="text-gray-500 font-medium">الحصة المتاحة</p>
                  <p className="font-semibold">{company.available_equity}%</p>
                </div>
              )}
              {company.investment_type && (
                <div>
                  <p className="text-gray-500 font-medium">نوع الاستثمار</p>
                  <p className="font-semibold">{company.investment_type}</p>
                </div>
              )}
              {company.company_status && (
                <div>
                  <p className="text-gray-500 font-medium">مرحلة الشركة</p>
                  <p className="font-semibold">{company.company_status}</p>
                </div>
              )}
              {company.funding_round_status && (
                <div>
                  <p className="text-gray-500 font-medium">جولة التمويل</p>
                  <p className="font-semibold">{company.funding_round_status}</p>
                </div>
              )}
            </div>
          </section>
        )}

        <CreatePost 
          companyId={company.id} 
          companyName={company.name} 
          companyLogo={company.logo}
          companyOwnerId={company.user_id}
        />

        {/* Company Posts */}
        <section className="li-card p-6">
          <h2 className="text-lg font-semibold mb-3">Posts</h2>
          {postsLoading ? (
            <p className="text-sm text-gray-500">Loading posts…</p>
          ) : posts.length === 0 ? (
            <p className="text-sm text-gray-500">No posts yet.</p>
          ) : (
            <div className="space-y-4">
              {posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )}
        </section>

        {/* About */}
        <section className="li-card p-6">
          <h2 className="text-lg font-semibold mb-3">About</h2>
          <p className="text-sm leading-relaxed text-gray-700">{company.about}</p>
        </section>

        {/* Investment Details (visible on main column) */}
        {company.is_looking_for_investors && (
          <section className="li-card p-6">
            <h2 className="text-lg font-semibold mb-3">Investment Details</h2>
            <div className="grid gap-3 text-sm text-gray-700">
              <div className="grid sm:grid-cols-2 gap-2">
                {company.valuation != null && (
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">Estimated Valuation</p>
                    <p className="font-medium">${company.valuation.toLocaleString()}</p>
                  </div>
                )}
                {company.investment_type && (
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">Investment Type</p>
                    <p className="font-medium">{company.investment_type}</p>
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-2">
                {company.funding_amount != null && (
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">Requested Funding</p>
                    <p className="font-medium">${company.funding_amount.toLocaleString()}</p>
                  </div>
                )}
                {company.available_equity != null && (
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">Available Equity</p>
                    <p className="font-medium">{company.available_equity}%</p>
                  </div>
                )}
              </div>

              {company.funding_round_status && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Funding Round Status</p>
                  <p className="font-medium">{company.funding_round_status}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-2">
                {company.owner_name && (
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">Owner</p>
                    <p className="font-medium">{company.owner_name}</p>
                  </div>
                )}
                {company.ceo_name && (
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">CEO</p>
                    <p className="font-medium">{company.ceo_name}</p>
                  </div>
                )}
              </div>

              {company.about && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">About</p>
                  <p className="font-medium">{company.about}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Employees */}
        <section className="li-card p-6">
          <h2 className="text-lg font-semibold mb-4">People</h2>
          <div className="space-y-3">
            {company.employees?.map((emp) => (
              <Link
                key={emp.id}
                to={`/in/${emp.id}`}
                className="flex items-center gap-3 p-3 rounded hover:bg-gray-50"
              >
                <img src={emp.avatar} alt={emp.name} className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-sm hover:text-[#0a66c2]">{emp.name}</p>
                  <p className="text-xs text-gray-600">{emp.role}</p>
                  <p className="text-xs text-gray-500">{emp.headline}</p>
                </div>
              </Link>
            ))}
          </div>
          {company.employees?.length === 0 && (
            <p className="text-sm text-gray-500">No employees listed</p>
          )}
        </section>

        {/* Jobs */}
        <section className="li-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Open positions</h2>
              <p className="text-sm text-gray-600">Jobs posted for this company.</p>
            </div>
            <button
              onClick={() => setIsJobPostingModalOpen(true)}
              className="flex items-center gap-2 bg-[#0a66c2] text-white px-3 py-2 rounded-full text-sm font-semibold hover:bg-[#004182]"
            >
              <Plus className="w-4 h-4" /> Post a job
            </button>
          </div>
          {jobsLoading ? (
            <p className="text-sm text-gray-500">Loading jobs…</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-gray-500">No open positions at this company yet.</p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="border border-gray-100 rounded-2xl p-3 hover:bg-gray-50 transition">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-sm text-[#0a66c2]">{job.title}</h3>
                      <p className="text-xs text-gray-600">{job.location || 'No location provided'}</p>
                    </div>
                    <span className="text-xs text-gray-500">{job.postedAgo || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Position Requests - Only for company owner */}
        {(user?.is_admin || user?.id === company.user_id) && (
          <PositionRequestsList company={company} />
        )}

        <CreateJobPostingModal
          isOpen={isJobPostingModalOpen}
          onClose={() => setIsJobPostingModalOpen(false)}
          onSuccess={() => {
            if (company) {
              setJobsLoading(true);
              jobsApi.getCompanyPostings(company.id)
                .then((data) => setJobs(data || []))
                .catch(() => setJobs([]))
                .finally(() => setJobsLoading(false));
            }
          }}
          initialCompany={company}
        />
      </div>

      {/* Sidebar */}
      <div className="hidden lg:block lg:col-span-4">
        <div className="li-card p-6 sticky top-20">
          <h3 className="font-semibold mb-4">Quick info</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-600 text-xs font-semibold uppercase">Industry</p>
              <p className="font-medium">{company.industry}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-semibold uppercase">Location</p>
              <p className="font-medium">{company.location}</p>
            </div>
            <div>
              <p className="text-gray-600 text-xs font-semibold uppercase">Employees</p>
              <p className="font-medium">{company.employees_count}</p>
            </div>
            {company.website && (
              <div>
                <p className="text-gray-600 text-xs font-semibold uppercase">Website</p>
                <a
                  href={company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0a66c2] hover:underline font-medium break-all text-xs"
                >
                  {company.website}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Investment Info */}
        {company.is_looking_for_investors && (
          <div className="li-card p-6 mt-4 sticky top-52 border-l-4 border-amber-400">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold">Investment Information</h3>
            </div>
            <div className="space-y-3 text-sm">
              {company.valuation && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Estimated Valuation</p>
                  <p className="font-medium">${company.valuation.toLocaleString()}</p>
                </div>
              )}
              {company.investment_type && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Type of Investment</p>
                  <p className="font-medium">{company.investment_type}</p>
                </div>
              )}
              {company.funding_amount && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Requested Funding</p>
                  <p className="font-medium">${company.funding_amount.toLocaleString()}</p>
                </div>
              )}
              {company.company_status && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Company Status</p>
                  <p className="font-medium">{company.company_status}</p>
                </div>
              )}
              {company.available_equity && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Available Equity</p>
                  <p className="font-medium">{company.available_equity}%</p>
                </div>
              )}
              {company.funding_round_status && (
                <div>
                  <p className="text-gray-600 text-xs font-semibold uppercase">Funding Round</p>
                  <p className="font-medium">{company.funding_round_status}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="company"
        targetId={company.id}
        targetName={company.name}
      />
    </div>
  );
}
