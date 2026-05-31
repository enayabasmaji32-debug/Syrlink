import React, { useEffect, useState } from 'react';
import { verificationApi } from '../api';
import { CheckCircle2, Clock, AlertCircle, XCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function VerificationTracking() {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequest();
  }, []);

  const loadRequest = async () => {
    try {
      const req = await verificationApi.me();
      setRequest(req);
    } catch (e) {
      toast.error('Failed to load verification status');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0a66c2]" />
      </div>
    );
  }

  if (!request || request.status === 'none') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-600">No active verification request</p>
      </div>
    );
  }

  const STAGES = [
    { id: 'identity_check', label: 'Identity Check', icon: '🔍' },
    { id: 'face_match', label: 'Face Matching', icon: '👤' },
    { id: 'under_review', label: 'Under Review', icon: '⏳' },
    { id: 'final_decision', label: 'Final Decision', icon: '✓' },
  ];

  const stagesCompleted = request.stages_completed || [];
  const currentStage = request.current_stage || 'identity_check';
  const stageIndex = STAGES.findIndex((s) => s.id === currentStage);

  const STATUS_CONFIG = {
    pending: { icon: Clock, label: 'Pending Review', color: 'text-blue-600', bg: 'bg-blue-50' },
    approved: { icon: CheckCircle2, label: 'Approved', color: 'text-green-600', bg: 'bg-green-50' },
    rejected: { icon: XCircle, label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50' },
  };

  const config = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className={`${config.bg} border rounded-lg p-4`}>
        <div className="flex items-center gap-3">
          <StatusIcon className={`w-6 h-6 ${config.color}`} />
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{config.label}</p>
            {request.request_id && (
              <p className="text-xs text-gray-600">Request ID: {request.request_id}</p>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Reason */}
      {request.status === 'rejected' && request.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-red-900">Rejection Reason:</p>
          <p className="text-sm text-red-800 mt-1">{request.rejection_reason}</p>
        </div>
      )}

      {/* Progress Stages */}
      {request.status === 'pending' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-900">Verification Progress</p>
          {STAGES.map((stage, idx) => {
            const isCompleted = stagesCompleted.includes(stage.id);
            const isCurrent = stage.id === currentStage;

            return (
              <div key={stage.id} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isCurrent
                      ? 'bg-[#0a66c2] text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {isCompleted ? '✓' : stage.icon.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>
                    {stage.label}
                  </p>
                  {isCurrent && <p className="text-xs text-blue-600">Currently under review</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Document Info */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="w-4 h-4" /> Document Details
        </p>
        <div className="text-sm text-gray-700 space-y-1">
          <p>
            <strong>Type:</strong>{' '}
            {
              {
                id: 'National ID / Passport',
                experience: 'Work Certificate',
                education: 'Diploma / Degree',
                other: 'Other Document',
              }[request.document_type]
            }
          </p>
          {request.note && (
            <p>
              <strong>Note:</strong> {request.note}
            </p>
          )}
          <p className="text-xs text-gray-600">
            Submitted on {new Date(request.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Timeline */}
      {request.reviewed_at && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-900">Review Timeline</p>
          <div className="text-sm text-gray-700 mt-2 space-y-1">
            <p>
              <strong>Submitted:</strong> {new Date(request.created_at).toLocaleString()}
            </p>
            <p>
              <strong>Reviewed:</strong> {new Date(request.reviewed_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
        <strong>Need help?</strong> If you have questions about your verification status, please contact support.
      </div>
    </div>
  );
}
