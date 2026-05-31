import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { verificationApi, uploadApi } from '../api';
import { ShieldCheck, Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export default function VerificationRequestProfessional({ onClose }) {
  const { user } = useApp();
  const [step, setStep] = useState(1); // 1: Document Type, 2: Upload, 3: Confirm, 4: Success
  const [docType, setDocType] = useState('id');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const docTypes = {
    id: { label: 'National ID / Passport', icon: '🪪', desc: 'Government-issued photo ID' },
    experience: { label: 'Work Certificate', icon: '💼', desc: 'Certificate or letter from employer' },
    education: { label: 'Diploma / Degree', icon: '🎓', desc: 'Educational qualification' },
    other: { label: 'Other Document', icon: '📄', desc: 'Any supporting documentation' },
  };

  const submit = async () => {
    if (!file) {
      toast.error('Please choose a document');
      return;
    }
    setSubmitting(true);
    try {
      const up = await uploadApi.uploadFile(file, `verification/${user.id}`);
      if (!up.secure_url) throw new Error('upload failed');
      const res = await verificationApi.submit({
        document_url: up.secure_url,
        document_type: docType,
        note,
      });
      setRequestId(res.request_id);
      setStep(4); // Success screen
      toast.success('✓ Verification request submitted successfully!');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = [
    { num: 1, label: 'Document Type' },
    { num: 2, label: 'Upload Document' },
    { num: 3, label: 'Review & Submit' },
    { num: 4, label: 'Complete' },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#0a66c2]" />
            <DialogTitle className="text-2xl">Get Verified</DialogTitle>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Boost your credibility with a verified blue badge ✓
          </p>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="flex items-center gap-2 mt-6 mb-8">
          {STEPS.map((s) => (
            <div key={s.num} className="flex-1 flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition ${
                  step >= s.num
                    ? 'bg-[#0a66c2] text-white'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
              </div>
              {s.num < STEPS.length && (
                <div
                  className={`flex-1 h-1 mx-2 rounded transition ${
                    step > s.num ? 'bg-[#0a66c2]' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Document Type Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Which document do you want to verify?</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(docTypes).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setDocType(key)}
                  className={`p-4 rounded-lg border-2 transition text-left ${
                    docType === key
                      ? 'border-[#0a66c2] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{val.icon}</div>
                  <div className="font-semibold text-sm text-gray-900">{val.label}</div>
                  <div className="text-xs text-gray-600 mt-1">{val.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-3 transition"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Upload Document */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Upload your document</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#0a66c2] transition cursor-pointer relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  setFile(e.target.files?.[0]);
                  if (e.target.files?.[0]) {
                    toast.success(`File selected: ${e.target.files[0].name}`);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                  <p className="font-semibold text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-600">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="font-semibold text-gray-900">Drag & drop or click to upload</p>
                  <p className="text-xs text-gray-600">JPG, PNG, PDF up to 5MB</p>
                </div>
              )}
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <strong>Tip:</strong> Make sure your document is clear, well-lit, and fully visible.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-900 font-semibold rounded-full py-2 hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!file}
                className="flex-1 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2 transition"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Add Note */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Review your submission</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Document Type</label>
                <p className="text-sm text-gray-900 mt-1">{docTypes[docType].label}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">File</label>
                <p className="text-sm text-gray-900 mt-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> {file?.name}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-2">
                Additional Notes (optional)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any relevant information that might help with verification..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
              />
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                Once submitted, our team will review your document within 3-5 business days.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-300 text-gray-900 font-semibold rounded-full py-2 hover:bg-gray-50 transition"
              >
                Back
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-400 text-white font-semibold rounded-full py-2 flex items-center justify-center gap-2 transition"
              >
                <Upload className="w-4 h-4" /> {submitting ? 'Submitting…' : 'Submit for Review'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center space-y-4 py-6">
            <div className="flex justify-center">
              <div className="bg-green-100 rounded-full p-4">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 text-lg">Submission Successful!</h4>
              <p className="text-sm text-gray-600 mt-2">
                Your verification request has been submitted and assigned ID:
              </p>
              <p className="font-mono text-sm font-bold text-[#0a66c2] mt-1">{requestId}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-left">
              <p className="text-sm font-semibold text-gray-900 mb-2">What happens next?</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Our team will review your document within 3-5 business days</li>
                <li>✓ You'll receive notifications on each stage of the review</li>
                <li>✓ Once approved, you'll get a blue verified badge</li>
              </ul>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-2 transition"
            >
              Close
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
