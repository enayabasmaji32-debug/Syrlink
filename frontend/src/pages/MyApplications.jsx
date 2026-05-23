import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { jobsApi } from '../api';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { ArrowLeft, FileText, CheckCircle2, XCircle, Download, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function MyApplications() {
  const { user } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [postings, setPostings] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [decidingId, setDecidingId] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (user?.id) {
      jobsApi.getCompanyPostings(user.id)
        .then(setPostings)
        .catch((e) => {
          console.error('Failed to load postings:', e);
          toast.error('Failed to load your postings');
        })
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  const handleSelectJob = async (jobId) => {
    setSelectedJobId(jobId);
    setLoadingApplicants(true);
    try {
      const apps = await jobsApi.getApplicants(jobId);
      setApplicants(apps);
    } catch (e) {
      console.error('Failed to load applicants:', e);
      toast.error('Failed to load applicants');
      setApplicants([]);
    } finally {
      setLoadingApplicants(false);
    }
  };

  const handleDecide = (app, actionType) => {
    setCurrentApp(app);
    setAction(actionType);
    setReason('');
    setShowReasonModal(true);
  };

  const submitDecision = async () => {
    if (!currentApp) return;
    
    setDecidingId(currentApp.id);
    try {
      await jobsApi.decideApplication(currentApp.id, action, reason);
      toast.success(`Application ${action}ed successfully`);
      // Refresh applicants
      if (selectedJobId) {
        const apps = await jobsApi.getApplicants(selectedJobId);
        setApplicants(apps);
      }
      setShowReasonModal(false);
      setCurrentApp(null);
    } catch (e) {
      console.error('Decision error:', e);
      toast.error(e.response?.data?.detail || 'Failed to decide on application');
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4 text-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!postings.length) {
    return (
      <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/jobs')} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">Applications & Applicants</h1>
        </div>
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">You haven't posted any jobs yet</p>
          <Button onClick={() => navigate('/jobs')}>Post a Job</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/jobs')} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold">Applications & Applicants</h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Postings list */}
        <div className="col-span-12 lg:col-span-4 space-y-2">
          <h2 className="text-lg font-semibold mb-3">Your Postings</h2>
          {postings.map((job) => (
            <Card
              key={job.id}
              className={`p-4 cursor-pointer transition ${
                selectedJobId === job.id ? 'border-2 border-blue-500 bg-blue-50' : 'border border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => handleSelectJob(job.id)}
            >
              <h3 className="font-semibold text-sm line-clamp-2">{job.title}</h3>
              <p className="text-xs text-gray-600 mt-1">{job.location}</p>
              <div className="mt-2 text-xs text-blue-600 font-medium">
                View Applicants →
              </div>
            </Card>
          ))}
        </div>

        {/* Applicants list */}
        <div className="col-span-12 lg:col-span-8">
          {!selectedJobId ? (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Select a posting to view applicants</p>
            </Card>
          ) : loadingApplicants ? (
            <Card className="p-12 text-center">
              <p className="text-gray-600">Loading applicants...</p>
            </Card>
          ) : applicants.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No applicants yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                Applicants ({applicants.length})
              </h2>
              {applicants.map((app) => (
                <Card key={app.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {app.applicant?.avatar && (
                          <img
                            src={app.applicant.avatar}
                            alt={app.applicant?.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold">{app.applicant?.name || 'Unknown'}</h3>
                          <p className="text-xs text-gray-600">{app.applicant?.email}</p>
                          {app.applicant?.headline && (
                            <p className="text-sm text-gray-700 mt-1">{app.applicant.headline}</p>
                          )}
                        </div>
                      </div>

                      {/* CV Link */}
                      {app.cv_url && (
                        <div className="mt-3 flex items-center gap-2">
                          <a
                            href={app.cv_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-blue-600 hover:underline text-sm"
                          >
                            <FileText className="w-4 h-4" />
                            View CV
                          </a>
                          <a
                            href={app.cv_url}
                            download
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        </div>
                      )}

                      {/* Application date */}
                      <p className="text-xs text-gray-500 mt-2">
                        Applied: {new Date(app.applied_at).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Action buttons */}
                    {app.status === 'applied' ? (
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => handleDecide(app, 'accept')}
                          disabled={decidingId === app.id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecide(app, 'reject')}
                          disabled={decidingId === app.id}
                          className="border-red-300 text-red-600 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right ml-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${
                          app.status === 'accepted' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {app.status === 'accepted' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Accepted
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </>
                          )}
                        </span>
                        {app.decision_reason && (
                          <p className="text-xs text-gray-600 mt-1">Reason: {app.decision_reason}</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reason Modal */}
      {showReasonModal && currentApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md mx-auto">
            <h2 className="text-xl font-semibold mb-4">
              {action === 'accept' ? 'Accept Application' : 'Reject Application'}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              For <strong>{currentApp.applicant?.name}</strong>
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={action === 'accept' 
                ? 'Optional: Add a message for the applicant...' 
                : 'Optional: Explain why you\'re rejecting...'}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm"
              rows="4"
            />
            <div className="flex gap-2 mt-4 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowReasonModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={submitDecision}
                disabled={decidingId === currentApp.id}
                className={action === 'accept' 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-red-600 hover:bg-red-700'}
              >
                {action === 'accept' ? 'Accept' : 'Reject'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
