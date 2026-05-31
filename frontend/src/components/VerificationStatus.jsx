import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { verificationApi } from '../api';
import { CheckCircle2, AlertCircle, Clock, Loader2, Copy, ExternalLink, Shield, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function VerificationStatus() {
  const { user } = useApp();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await verificationApi.me();
        setRequest(data);
      } catch (e) {
        // No pending request
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="text-xs text-gray-500">🔄 Loading verification status...</div>;
  if (!request) return null;

  const allStages = ['identity_check', 'face_match', 'under_review', 'final_decision'];
  
  const stageInfo = {
    'identity_check': {
      emoji: '🔍',
      label: 'Identity Check',
      description: 'Verifying your ID documents'
    },
    'face_match': {
      emoji: '👤',
      label: 'Face Match',
      description: 'Matching your face with ID'
    },
    'under_review': {
      emoji: '📝',
      label: 'Under Review',
      description: 'Final verification in progress'
    },
    'final_decision': {
      emoji: '✓',
      label: 'Final Decision',
      description: 'Getting your blue badge'
    },
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(request.request_id);
    toast.success('Request ID copied!');
  };

  const statusConfig = {
    pending: {
      title: '⏳ Verification in Progress',
      color: 'from-orange-100 to-orange-50',
      borderColor: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-800',
      icon: Clock,
    },
    approved: {
      title: '✓ Verified Successfully',
      color: 'from-green-100 to-green-50',
      borderColor: 'border-green-200',
      badge: 'bg-green-100 text-green-800',
      icon: CheckCircle2,
    },
    rejected: {
      title: '❌ Verification Rejected',
      color: 'from-red-100 to-red-50',
      borderColor: 'border-red-200',
      badge: 'bg-red-100 text-red-800',
      icon: AlertCircle,
    },
  };

  const config = statusConfig[request.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <div className="li-card overflow-hidden mt-6 border-2 border-blue-100">
      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color} ${config.borderColor} border-b-2 px-6 py-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-white rounded-full shadow-sm">
              <StatusIcon className={`w-6 h-6 ${
                request.status === 'pending' ? 'text-orange-600' :
                request.status === 'approved' ? 'text-green-600' :
                'text-red-600'
              }`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{config.title}</h3>
              {request.request_id && (
                <div className="mt-2 flex items-center gap-2">
                  <p className="text-xs text-gray-600"><strong>Request ID:</strong></p>
                  <code className="text-sm font-mono font-bold text-[#0a66c2] bg-white px-3 py-1 rounded border border-gray-200">{request.request_id}</code>
                  <button onClick={copyToClipboard} className="p-1 hover:bg-white rounded transition">
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap ${config.badge}`}>
            {request.current_stage?.replace(/_/g, ' ').toUpperCase() || 'PENDING'}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Verification Progress Timeline */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0a66c2]" />
            Verification Stages
          </h4>
          <div className="space-y-3">
            {allStages.map((stage, idx) => {
              const completed = request.stages_completed?.includes(stage);
              const isCurrent = request.current_stage === stage;
              const info = stageInfo[stage];

              return (
                <div key={stage} className="flex gap-4">
                  {/* Timeline connector */}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                      completed
                        ? 'bg-green-100 text-green-700 border-2 border-green-600'
                        : isCurrent
                        ? 'bg-[#0a66c2] text-white border-2 border-[#004182] animate-pulse'
                        : 'bg-gray-200 text-gray-600 border-2 border-gray-300'
                    }`}>
                      {completed ? '✓' : info.emoji}
                    </div>
                    {idx < allStages.length - 1 && (
                      <div className={`w-1 h-8 my-1 ${completed ? 'bg-green-300' : 'bg-gray-300'}`} />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div className={`flex-1 py-1 ${completed ? 'opacity-60' : ''} ${isCurrent ? 'opacity-100' : ''}`}>
                    <p className="font-semibold text-gray-900">{info.label}</p>
                    <p className="text-xs text-gray-600">{info.description}</p>
                    {completed && <p className="text-xs text-green-600 mt-1">✓ Completed</p>}
                    {isCurrent && <p className="text-xs text-[#0a66c2] font-semibold mt-1">🔄 Current Stage</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Document Information */}
        {request.document_url && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-700" />
              Submitted Documents
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                <span className="text-gray-700">
                  {request.document_type === 'id_front' ? '🪪 ID - Front' :
                   request.document_type === 'id' ? '🪪 ID Document' :
                   request.document_type === 'experience' ? '💼 Work Certificate' :
                   request.document_type === 'education' ? '🎓 Diploma' :
                   '📄 Document'}
                </span>
                <a href={request.document_url} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:text-[#005ba1] font-semibold flex items-center gap-1 transition">
                  View <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              {request.id_back && (
                <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                  <span className="text-gray-700">🔙 ID - Back</span>
                  <a href={request.id_back} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:text-[#005ba1] font-semibold flex items-center gap-1 transition">
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {request.selfie && (
                <div className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                  <span className="text-gray-700">🤳 Live Selfie</span>
                  <a href={request.selfie} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:text-[#005ba1] font-semibold flex items-center gap-1 transition">
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submission Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-gray-600 mb-1"><strong>Submitted</strong></p>
            <p className="font-semibold text-gray-900">{new Date(request.created_at).toLocaleDateString()}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="text-xs text-gray-600 mb-1"><strong>Last Updated</strong></p>
            <p className="font-semibold text-gray-900">{new Date(request.updated_at || request.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Additional Notes */}
        {request.note && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-xs text-gray-600 mb-2"><strong>Your Notes:</strong></p>
            <p className="text-sm text-gray-800 italic">{request.note}</p>
          </div>
        )}

        {/* Rejection Reason */}
        {request.status === 'rejected' && request.rejection_reason && (
          <div className="bg-red-50 rounded-xl p-4 border-2 border-red-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-800 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-700">{request.rejection_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {request.status === 'pending' && (
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <p className="text-sm text-amber-800">
              ⏱️ <strong>Most verifications are completed within 24-48 hours.</strong> You'll receive a notification when your status changes. Save your Request ID for future reference.
            </p>
          </div>
        )}

        {request.status === 'approved' && (
          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
            <p className="text-sm text-green-800">
              🎉 <strong>Congratulations!</strong> Your account is now verified. You can display your blue badge on your profile.
            </p>
          </div>
        )}

        {/* Security Badge */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 flex items-start gap-3">
          <Shield className="w-5 h-5 text-[#0a66c2] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            <strong>🔒 Your data is secure.</strong> All documents are encrypted end-to-end. We never store raw photos.
          </p>
        </div>
      </div>
    </div>
  );
}
