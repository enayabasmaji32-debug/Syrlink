import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { verificationApi } from '../api';
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

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

  if (loading) return <div className="text-xs text-gray-500">Loading verification status...</div>;
  if (!request) return null;

  const stageLabels = {
    'identity_check': '🔍 Identity Check',
    'face_match': '👤 Face Match',
    'under_review': '⏳ Under Review',
    'final_decision': '✓ Final Decision',
  };

  const stageEmojis = {
    'identity_check': '🔍',
    'face_match': '👤',
    'under_review': '⏳',
    'final_decision': '✓',
  };

  const allStages = ['identity_check', 'face_match', 'under_review', 'final_decision'];

  return (
    <div className="li-card p-4 mt-4 border-l-4 border-[#0a66c2] bg-gradient-to-r from-blue-50 to-transparent">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {request.status === 'pending' && <Clock className="w-4 h-4 text-orange-500" />}
            {request.status === 'approved' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
            {request.status === 'rejected' && <AlertCircle className="w-4 h-4 text-red-500" />}
            <h3 className="font-semibold text-sm">
              {request.status === 'pending' && '⏳ Verification Pending'}
              {request.status === 'approved' && '✓ Verified'}
              {request.status === 'rejected' && '❌ Rejected'}
            </h3>
          </div>
          {request.request_id && (
            <p className="text-xs text-gray-600">ID: <span className="font-mono text-[#0a66c2]">{request.request_id}</span></p>
          )}
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          request.status === 'pending' ? 'bg-orange-100 text-orange-700' :
          request.status === 'approved' ? 'bg-green-100 text-green-700' :
          'bg-red-100 text-red-700'
        }`}>
          {request.current_stage?.replace('_', ' ').toUpperCase() || 'PENDING'}
        </span>
      </div>

      {/* Stage Progress */}
      <div className="mb-3">
        <p className="text-xs font-semibold text-gray-700 mb-2">Verification Progress:</p>
        <div className="flex gap-1">
          {allStages.map((stage) => {
            const completed = request.stages_completed?.includes(stage);
            const isCurrent = request.current_stage === stage;
            return (
              <div
                key={stage}
                className={`flex-1 h-6 rounded flex items-center justify-center text-xs font-bold transition ${
                  completed
                    ? 'bg-green-100 text-green-700'
                    : isCurrent
                    ? 'bg-[#0a66c2] text-white border-2 border-[#004182]'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {stageEmojis[stage]}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1 text-xs text-gray-600">
          <span className="flex-1 text-center">ID</span>
          <span className="flex-1 text-center">Face</span>
          <span className="flex-1 text-center">Review</span>
          <span className="flex-1 text-center">Decision</span>
        </div>
      </div>

      {/* Document Info */}
      <div className="bg-white rounded p-2 mb-3 text-xs space-y-1 border border-gray-200">
        <p><strong>Document:</strong> {
          request.document_type === 'id' ? '🪪 National ID' :
          request.document_type === 'experience' ? '💼 Work Certificate' :
          request.document_type === 'education' ? '🎓 Diploma' :
          '📄 Other'
        }</p>
        <p><strong>Submitted:</strong> {new Date(request.created_at).toLocaleDateString()}</p>
        {request.note && <p><strong>Notes:</strong> {request.note}</p>}
        {request.document_url && (
          <a href={request.document_url} target="_blank" rel="noreferrer" className="text-[#0a66c2] hover:underline text-xs">
            📄 View document →
          </a>
        )}
      </div>

      {/* Rejection Reason */}
      {request.status === 'rejected' && request.rejection_reason && (
        <div className="bg-red-50 rounded p-2 border border-red-200 text-xs">
          <p className="font-semibold text-red-700 mb-1">Rejection Reason:</p>
          <p className="text-red-600">{request.rejection_reason}</p>
        </div>
      )}

      {/* Status Message */}
      {request.status === 'pending' && (
        <p className="text-xs text-gray-600 italic">
          Admin is reviewing your submission. You'll be notified once we move to the next stage.
        </p>
      )}
    </div>
  );
}
