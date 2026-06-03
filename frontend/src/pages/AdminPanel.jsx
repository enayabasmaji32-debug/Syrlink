import React, { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { adminApi, reportsApi } from '../api';
import { ShieldCheck, Users, FileText, Briefcase, BadgeCheck, Trash2, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminPanel() {
  const { user, authReady } = useApp();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [verifs, setVerifs] = useState([]);
  const [companyReqs, setCompanyReqs] = useState([]);
  const [approvedCompanies, setApprovedCompanies] = useState([]);
  const [reports, setReports] = useState([]);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [decisionModal, setDecisionModal] = useState(null);
  const [decisionAction, setDecisionAction] = useState('approve');
  const [decisionReason, setDecisionReason] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, u, v, c, ac, r] = await Promise.all([adminApi.stats(), adminApi.users(q), adminApi.verifications('pending'), adminApi.companyRequests('pending'), adminApi.companies('approved'), reportsApi.list('pending')]);
      setStats(s); setUsers(u); setVerifs(v); setCompanyReqs(c); setApprovedCompanies(ac); setReports(r);
    } catch (e) {
      if (e && e.message) {
        toast.error(e.message);
      } else {
        toast.error('Failed to load admin data');
      }
    }
    setLoading(false);
  };

  useEffect(() => { if (user?.is_admin) load(); }, [user, q]);

  if (!authReady) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) return (
    <div className="max-w-md mx-auto mt-20 li-card p-8 text-center">
      <ShieldCheck className="w-12 h-12 text-red-500 mx-auto" />
      <h1 className="text-xl font-bold mt-3">Access Denied</h1>
      <p className="text-sm text-gray-600 mt-2">You need admin privileges to view this page.</p>
      <Link to="/" className="text-[#0a66c2] font-semibold mt-4 inline-block">← Back to feed</Link>
    </div>
  );

  const toggleVerify = async (uid) => {
    const r = await adminApi.toggleVerify(uid);
    toast.success(r.verified ? 'User verified ✓' : 'Verification removed');
    load();
  };
  const del = async (uid) => {
    if (!globalThis.confirm('Delete this user and all their posts?')) return;
    await adminApi.deleteUser(uid); toast.success('User deleted'); load();
  };
  const approve = async (id) => { await adminApi.approve(id); toast.success('Approved + verified'); load(); };
  const reject = async (id, reason = '') => { 
    if (reason) {
      await adminApi.reject(id, reason); 
      toast.success('Request rejected with reason');
    } else {
      await adminApi.reject(id); 
      toast('Request rejected');
    }
    load(); 
  };
  const decideCompany = async (action) => {
    if (!decisionModal) {
      toast.error('حدث خطأ، حاول مرة أخرى');
      return;
    }
    if (action === 'reject' && !decisionReason.trim()) {
      toast.error('الرجاء كتابة السبب');
      return;
    }
    setDeciding(true);
    try {
      await adminApi.decideCompany(decisionModal.id, action, decisionReason);
      toast.success(action === 'approve' ? '✓ تم الموافقة' : '✓ تم الرفض');
      setDecisionModal(null);
      setDecisionReason('');
      load();
    } catch (e) {
      toast.error('حدث خطأ');
    }
    setDeciding(false);
  };
  const deleteCompany = async (id, name) => {
    if (!globalThis.confirm(`حذف الشركة "${name}"؟ سيتم حذف جميع الإعلانات الوظيفية المرتبطة بها أيضاً.`)) return;
    try {
      await adminApi.deleteCompany(id);
      toast.success('✓ تم حذف الشركة بنجاح');
      load();
    } catch (e) {
      if (e && e.message) {
        toast.error(e.message);
      } else {
        toast.error('فشل حذف الشركة');
      }
    }
  };
  // --- بلاغات ---
  const [reportModal, setReportModal] = useState(null); // {report, action}
  const [reportReason, setReportReason] = useState('');
  const [processingReport, setProcessingReport] = useState(false);

  const handleReportAction = (report, action) => {
    // إذا كان الإجراء يحتاج سبب، افتح مودال
    if (action === 'reject' || action === 'ban' || action === 'dismiss') {
      setReportModal({ report, action });
      setReportReason('');
    } else {
      resolveReport(report, action);
    }
  };

  const resolveReport = async (report, action, reason = '') => {
    setProcessingReport(true);
    try {
      await reportsApi.resolve(report.id, action, reason);
      toast.success('✓ تم تنفيذ الإجراء');
      setReportModal(null);
      setReportReason('');
      load();
    } catch (e) {
      if (e && e.message) {
        toast.error(e.message);
      } else {
        toast.error('فشل معالجة البلاغ');
      }
    }
    setProcessingReport(false);
  };

  return (
    <div className="max-w-[1128px] mx-auto px-4 py-6" data-testid="admin-panel">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-7 h-7 text-[#0a66c2]" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">RESTRICTED</span>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
          {[
            { label: 'Users', value: stats.users, Icon: Users },
            { label: 'Verified', value: stats.verified_users, Icon: BadgeCheck },
            { label: 'Posts', value: stats.posts, Icon: FileText },
            { label: 'Jobs', value: stats.jobs, Icon: Briefcase },
            { label: 'Connections', value: stats.connections, Icon: Users },
            { label: 'Pending Verif.', value: stats.pending_verifications, Icon: ShieldCheck },
          ].map((s) => (
            <div key={s.label} className="li-card p-3" data-testid={`admin-stat-${s.label.toLowerCase().replace(/\s/g,'-')}`}>
              <s.Icon className="w-4 h-4 text-gray-500" />
              <div className="text-2xl font-bold mt-1">{s.value}</div>
              <div className="text-xs text-gray-600">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        {['overview', 'users', 'verifications', 'companies', 'approved-companies', 'reports'].map((t) => {
          const getTabLabel = () => {
            switch (t) {
              case 'overview': return 'Overview';
              case 'users': return `Users (${users.length})`;
              case 'verifications': return `Verification Requests (${verifs.length})`;
              case 'companies': return `Company Requests (${companyReqs.length})`;
              case 'approved-companies': return `Approved Companies (${approvedCompanies.length})`;
              case 'reports': return `Reports (${reports.length})`;
              default: return t;
            }
          };
          return (
            <button key={t} onClick={() => setTab(t)} data-testid={`admin-tab-${t}`}
              className={`text-sm font-semibold rounded-full px-4 py-1.5 ${tab === t ? 'bg-[#0a66c2] text-white' : 'border border-gray-400 text-gray-700 hover:bg-gray-100'}`}>
              {getTabLabel()}
            </button>
          );
        })}
      </div>

      {loading && <Loader2 className="w-6 h-6 animate-spin text-[#0a66c2]" />}

      {tab === 'users' && (
        <div className="li-card p-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users by name or email"
            className="w-full bg-[#edf3f8] rounded px-3 py-2 text-sm mb-3 focus:outline-none"
            data-testid="admin-users-search" />
          <ul className="divide-y divide-gray-100">
            {users.map((u) => (
              <li key={u.id} className="py-3 flex items-center gap-3" data-testid={`admin-user-${u.id}`}>
                <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm">{u.name}</span>
                    {u.verified && <BadgeCheck className="w-4 h-4 text-[#0a66c2]" fill="#0a66c2" stroke="white" />}
                    {u.is_admin && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded">ADMIN</span>}
                  </div>
                  <p className="text-xs text-gray-600 truncate">{u.email} · {u.headline}</p>
                </div>
                <button onClick={() => toggleVerify(u.id)} data-testid={`admin-verify-${u.id}`}
                  className="text-xs font-semibold border border-[#0a66c2] text-[#0a66c2] rounded-full px-3 py-1 hover:bg-[#0a66c2]/10">
                  {u.verified ? 'Un-verify' : 'Verify ✓'}
                </button>
                {!u.is_admin && (
                  <button onClick={() => del(u.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`admin-delete-${u.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'verifications' && (
        <div className="li-card p-3">
          {verifs.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No pending verification requests.</p>}
          <ul className="divide-y divide-gray-200">
            {verifs.map((r) => (
              <li key={r.id} className="py-4">
                <div className="flex items-start gap-3 mb-3">
                  <img src={r.user?.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-gray-900">{r.user?.name}</div>
                    <p className="text-xs text-gray-600">{r.user?.email}</p>
                    {r.request_id && (
                      <p className="text-xs text-blue-600 font-mono mt-1">ID: {r.request_id}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                    {r.current_stage?.replace('_', ' ').toUpperCase() || 'IDENTITY CHECK'}
                  </span>
                </div>

                {/* Document Info */}
                <div className="bg-gray-50 rounded p-3 mb-3 text-xs space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                      <p className="text-gray-700 text-xs font-semibold mb-2">ID - Front</p>
                      {r.id_front || r.document_url ? (
                        <a href={r.id_front || r.document_url} target="_blank" rel="noreferrer" className="block text-[#0a66c2] hover:underline text-xs font-semibold">
                          View front image
                        </a>
                      ) : (
                        <p className="text-gray-500 text-[11px]">Not provided</p>
                      )}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                      <p className="text-gray-700 text-xs font-semibold mb-2">ID - Back</p>
                      {r.id_back ? (
                        <a href={r.id_back} target="_blank" rel="noreferrer" className="block text-[#0a66c2] hover:underline text-xs font-semibold">
                          View back image
                        </a>
                      ) : (
                        <p className="text-gray-500 text-[11px]">Not provided</p>
                      )}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                      <p className="text-gray-700 text-xs font-semibold mb-2">Live Selfie</p>
                      {r.selfie ? (
                        <a href={r.selfie} target="_blank" rel="noreferrer" className="block text-[#0a66c2] hover:underline text-xs font-semibold">
                          View selfie
                        </a>
                      ) : (
                        <p className="text-gray-500 text-[11px]">Not provided</p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <p><strong>Requested Type:</strong> {r.document_type}</p>
                    {r.note && <p><strong>Note:</strong> {r.note}</p>}
                    <p>Submitted: {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Stages Progress */}
                <div className="mb-3 flex gap-1 text-xs">
                  {['identity_check', 'face_match', 'under_review', 'final_decision'].map((stage) => {
                    const isCompleted = r.stages_completed?.includes(stage);
                    const isCurrent = r.current_stage === stage;
                    return (
                      <button
                        key={stage}
                        onClick={() => adminApi.updateStage(r.id, stage)}
                        className={`px-2 py-1 rounded transition text-xs font-semibold ${
                          isCompleted
                            ? 'bg-green-100 text-green-700'
                            : isCurrent
                            ? 'bg-blue-200 text-blue-900 border-2 border-blue-600'
                            : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        title={`Mark as ${stage.replace('_', ' ')}`}
                      >
                        {stage === 'identity_check' && '🔍'}
                        {stage === 'face_match' && '👤'}
                        {stage === 'under_review' && '⏳'}
                        {stage === 'final_decision' && '✓'}
                      </button>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(r.id)}
                    className="flex-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-full px-3 py-2 flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (reason) {
                        adminApi.reject(r.id, reason);
                        load();
                      }
                    }}
                    className="flex-1 text-xs font-semibold border border-red-400 text-red-600 rounded-full px-3 py-2 hover:bg-red-50 flex items-center justify-center gap-1"
                  >
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'companies' && (
        <div className="li-card p-3">
          {companyReqs.length === 0 && <p className="text-sm text-gray-500 text-center py-6">لا توجد طلبات شركات معلقة.</p>}
          <ul className="divide-y divide-gray-100">
            {companyReqs.map((c) => (
              <li key={c.id} className="py-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  {c.logo && (
                    <img src={c.logo} alt={c.name} className="w-16 h-16 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{c.name}</div>
                    <p className="text-xs text-gray-600">من: {c.user?.name} ({c.user?.email})</p>
                    <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                      <p><b>القطاع:</b> {c.industry}</p>
                      <p><b>الموقع:</b> {c.location || 'غير محدد'}</p>
                      <p><b>الموظفون:</b> {c.employees_count}</p>
                      <p><b>رقم التسجيل:</b> {c.registration_number}</p>
                    </div>
                    {c.about && <p className="text-xs text-gray-700 mt-2 italic">"{c.about}"</p>}
                    <p className="text-xs text-gray-500 mt-2">الحالة: <span className="font-semibold text-orange-600">{c.status === 'pending' ? 'معلق' : c.status}</span></p>
                  </div>
                </div>
                
                {/* Commercial Registry Image */}
                {c.commercial_registry_image && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-gray-700 mb-2">صورة السجل التجاري:</p>
                    <img 
                      src={c.commercial_registry_image} 
                      alt="Commercial Registry" 
                      className="max-w-xs max-h-48 rounded border border-gray-300" 
                    />
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => { setDecisionModal(c); setDecisionAction('approve'); setDecisionReason(''); }}
                    className="text-xs font-semibold bg-green-600 text-white rounded-full px-3 py-1 flex items-center gap-1 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-3 h-3" /> وافق
                  </button>
                  <button
                    onClick={() => { setDecisionModal(c); setDecisionAction('reject'); setDecisionReason(''); }}
                    className="text-xs font-semibold border border-red-400 text-red-600 rounded-full px-3 py-1 flex items-center gap-1 hover:bg-red-50"
                  >
                    <XCircle className="w-3 h-3" /> رفض
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'overview' && stats && (
        <div className="li-card p-5 text-sm">
          <h3 className="font-semibold text-base mb-2">Platform Health</h3>
          <p className="text-gray-700">{stats.users} users · {stats.posts} posts · {stats.verified_users} verified accounts ({Math.round(100 * stats.verified_users / Math.max(1, stats.users))}%)</p>
          <p className="text-gray-700 mt-1">{stats.pending_verifications} verification {stats.pending_verifications === 1 ? 'request' : 'requests'} awaiting your review.</p>
        </div>
      )}

      {tab === 'approved-companies' && (
        <div className="li-card p-3">
          {approvedCompanies.length === 0 && <p className="text-sm text-gray-500 text-center py-6">No approved companies.</p>}
          <ul className="divide-y divide-gray-100">
            {approvedCompanies.map((c) => (
              <li key={c.id} className="py-3 flex items-start gap-3">
                <img src={c.logo} alt={c.name} className="w-12 h-12 rounded object-cover" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <p className="text-xs text-gray-600">{c.industry} · {c.location}</p>
                  <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
                    <p><b>Employees:</b> {c.employees_count}</p>
                    <p><b>Registration:</b> {c.registration_number}</p>
                    {c.ceo_name && <p><b>CEO:</b> {c.ceo_name}</p>}
                    {c.owner_name && <p><b>Owner:</b> {c.owner_name}</p>}
                  </div>
                  {c.about && <p className="text-xs text-gray-700 mt-2 italic">"{c.about}"</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => deleteCompany(c.id, c.name)} className="p-1.5 rounded hover:bg-red-50 text-red-500" data-testid={`admin-delete-company-${c.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'reports' && (
        <div className="li-card p-3">
          {reports.length === 0 && <p className="text-sm text-gray-500 text-center py-6">لا توجد بلاغات معلقة.</p>}
          <ul className="divide-y divide-gray-100">
            {reports.map((r) => (
              <li key={r.id} className="py-4 flex items-start gap-3">
                <div className="flex flex-col items-center gap-2 min-w-[40px]">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                  <span className="text-xs font-bold text-red-700">{r.reason}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm mb-1">{
                    (() => {
                      switch (r.target_type) {
                        case 'post': return 'منشور';
                        case 'profile': return 'ملف شخصي';
                        case 'company': return ' شركة';
                        case 'job': return 'وظيفة';
                        default: return r.target_type;
                      }
                    })()
                  }</div>
                  <div className="text-xs text-gray-600 mb-1">من: {r.reporter?.name} ({r.reporter?.email})</div>
                  {r.details && <div className="text-xs text-gray-700 mb-1">تفاصيل: {r.details}</div>}
                  {r.target && (
                    <div className="text-xs text-gray-500 mb-1">
                      <b>المستهدف:</b> {r.target?.name || r.target?.title || r.target?.id}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">{new Date(r.created_at).toLocaleString('ar-EG')}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleReportAction(r, 'dismiss')}
                    className="text-xs font-semibold border border-gray-400 text-gray-700 rounded-full px-3 py-1 hover:bg-gray-100"
                  >
                    تجاهل
                  </button>
                  {r.target_type === 'post' && (
                    <button
                      onClick={() => handleReportAction(r, 'remove_content')}
                      className="text-xs font-semibold bg-yellow-600 text-white rounded-full px-3 py-1 hover:bg-yellow-700"
                    >
                      حذف المنشور
                    </button>
                  )}
                  <button
                    onClick={() => handleReportAction(r, 'ban')}
                    className="text-xs font-semibold bg-red-600 text-white rounded-full px-3 py-1 hover:bg-red-700"
                  >
                    حظر المستخدم
                  </button>
                  <button
                    onClick={() => handleReportAction(r, 'reject')}
                    className="text-xs font-semibold border border-blue-400 text-blue-700 rounded-full px-3 py-1 hover:bg-blue-50"
                  >
                    رفض مع سبب
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Company Decision Modal */}
      {decisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">{decisionAction === 'approve' ? 'موافقة على شركة' : 'رفض شركة'}</h2>
              <p className="text-sm text-gray-600 mt-1">{decisionModal.name}</p>
            </div>
            <div className="p-4">
              <label htmlFor="company-decision-reason" className="block text-sm font-semibold mb-2">السبب {decisionAction === 'approve' ? '(اختياري)' : '(مطلوب)'}</label>
              <textarea
                id="company-decision-reason"
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder={decisionAction === 'approve' ? 'اكتب سببًا إذا رغبت...' : 'اكتب سبب الرفض...'}
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a66c2] resize-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">{decisionReason.length}/500</p>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setDecisionModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                disabled={deciding}
              >
                إلغاء
              </button>
              <button
                onClick={() => decideCompany(decisionAction)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                disabled={deciding || (decisionAction === 'reject' && !decisionReason.trim())}
              >
                {deciding ? 'جاري...' : decisionAction === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}
      {reportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-lg">{
                reportModal.action === 'ban'
                  ? 'حظر المستخدم'
                  : (reportModal.action === 'dismiss' ? 'تجاهل البلاغ مع السبب' : 'رفض البلاغ مع سبب')
              }</h2>
              <p className="text-sm text-gray-600 mt-1">{reportModal.report.target?.name || reportModal.report.target?.title || reportModal.report.target?.id}</p>
            </div>
            <div className="p-4">
              <label htmlFor="report-reason" className="block text-sm font-semibold mb-2">السبب/الملاحظات</label>
              <textarea
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="أكتب السبب..."
                rows={4}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a66c2] resize-none text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">{reportReason.length}/500</p>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-2">
              <button
                onClick={() => setReportModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                disabled={processingReport}
              >
                إلغاء
              </button>
              <button
                onClick={() => resolveReport(reportModal.report, reportModal.action, reportReason)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                disabled={processingReport || !reportReason.trim()}
              >
                {processingReport ? 'جاري...' : 'تنفيذ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
