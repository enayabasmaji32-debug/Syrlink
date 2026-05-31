import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { verificationApi, uploadApi } from '../api';
import { ShieldCheck, Upload, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export default function VerificationRequest({ onClose }) {
  const { user } = useApp();
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState('id');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const reader = new FileReader();
      reader.onload = (ev) => setFilePreview(ev.target?.result);
      reader.readAsDataURL(f);
    }
  };

  const submit = async () => {
    if (!file) { toast.error('Please choose a document'); return; }
    setSubmitting(true);
    try {
      const up = await uploadApi.uploadFile(file, `verification/${user.id}`);
      if (!up.secure_url) throw new Error('upload failed');
      const result = await verificationApi.submit({ document_url: up.secure_url, document_type: docType, note });
      setRequestId(result.request_id);
      setStep(4);
      toast.success('Verification request submitted ✓');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit request');
      setSubmitting(false);
    }
  };

  // ===== STEP 1: Document Type Selection =====
  if (step === 1) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0a66c2]" />
              <DialogTitle>Get Verified with a Blue Badge</DialogTitle>
            </div>
            <p className="text-xs text-gray-600 mt-1">Step 1 of 4: Choose your document type</p>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="flex gap-2 items-center mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1">
                <div className={`h-1 rounded ${s <= step ? 'bg-[#0a66c2]' : 'bg-gray-300'}`} />
                <p className="text-xs text-gray-600 text-center mt-1">{s === 1 ? 'Type' : s === 2 ? 'Upload' : s === 3 ? 'Review' : 'Success'}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { val: 'id', label: '🪪 National ID / Passport', desc: 'Your ID card or passport' },
              { val: 'experience', label: '💼 Work Certificate', desc: 'Employment letter or certificate' },
              { val: 'education', label: '🎓 Diploma / Degree', desc: 'University certificate' },
              { val: 'other', label: '📄 Other Document', desc: 'Other proof' },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => { setDocType(opt.val); setStep(2); }}
                className={`p-4 border-2 rounded-lg text-left transition ${docType === opt.val ? 'border-[#0a66c2] bg-blue-50' : 'border-gray-300 hover:border-[#0a66c2]'}`}
              >
                <p className="font-semibold text-sm">{opt.label}</p>
                <p className="text-xs text-gray-600">{opt.desc}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 2: File Upload =====
  if (step === 2) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0a66c2]" />
              <DialogTitle>Upload Your Document</DialogTitle>
            </div>
            <p className="text-xs text-gray-600 mt-1">Step 2 of 4: Upload a clear image or PDF</p>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="flex gap-2 items-center mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1">
                <div className={`h-1 rounded ${s <= step ? 'bg-[#0a66c2]' : 'bg-gray-300'}`} />
                <p className="text-xs text-gray-600 text-center mt-1">{s === 1 ? 'Type' : s === 2 ? 'Upload' : s === 3 ? 'Review' : 'Success'}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Selected: <span className="text-[#0a66c2]">{docType === 'id' ? 'National ID' : docType === 'experience' ? 'Work Certificate' : docType === 'education' ? 'Diploma' : 'Other'}</span></p>
            </div>

            {/* Upload Area */}
            <div className="relative">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileChange}
                id="file-upload"
                className="hidden"
              />
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 hover:border-[#0a66c2] hover:bg-blue-50 cursor-pointer transition"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-sm font-semibold text-gray-700">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-500">PNG, JPG, PDF up to 10MB</p>
              </label>
            </div>

            {/* File Preview */}
            {filePreview && (
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Preview:</p>
                <img src={filePreview} alt="preview" className="max-h-40 rounded" />
                <p className="text-xs text-gray-600 mt-2">{file?.name}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 border border-gray-300 text-gray-700 font-semibold rounded-full py-2 hover:bg-gray-100">
                Back
              </button>
              <button onClick={() => file && setStep(3)} disabled={!file} className="flex-1 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2">
                Next <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 3: Review =====
  if (step === 3) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#0a66c2]" />
              <DialogTitle>Review Your Submission</DialogTitle>
            </div>
            <p className="text-xs text-gray-600 mt-1">Step 3 of 4: Verify everything looks good</p>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="flex gap-2 items-center mb-6">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex-1">
                <div className={`h-1 rounded ${s <= step ? 'bg-[#0a66c2]' : 'bg-gray-300'}`} />
                <p className="text-xs text-gray-600 text-center mt-1">{s === 1 ? 'Type' : s === 2 ? 'Upload' : s === 3 ? 'Review' : 'Success'}</p>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {/* Document Info */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <p><strong>Document Type:</strong> {docType === 'id' ? 'National ID / Passport' : docType === 'experience' ? 'Work Certificate' : docType === 'education' ? 'Diploma / Degree' : 'Other'}</p>
              <p><strong>File:</strong> {file?.name}</p>
              <p><strong>Size:</strong> {(file?.size / 1024).toFixed(2)} KB</p>
            </div>

            {/* Document Preview */}
            {filePreview && (
              <div className="border rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Document Preview:</p>
                <img src={filePreview} alt="preview" className="max-h-48 rounded w-full object-contain" />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Add notes (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., This is my official national ID card"
                rows={2}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 border border-gray-300 text-gray-700 font-semibold rounded-full py-2 hover:bg-gray-100">
                Back
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="flex-1 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2 flex items-center justify-center gap-1"
              >
                {submitting ? '🔄 Submitting...' : '✓ Submit for Review'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 4: Success =====
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
            <DialogTitle>Verification Submitted!</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-center py-4">
          <p className="text-sm text-gray-700">Your verification request has been submitted successfully.</p>

          {requestId && (
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-xs text-gray-600 mb-1">Your Request ID:</p>
              <p className="text-lg font-mono font-bold text-[#0a66c2]">{requestId}</p>
              <p className="text-xs text-gray-600 mt-1">Save this for reference. Admin will review within 24-48 hours.</p>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 space-y-1">
            <p>📋 <strong>What happens next:</strong></p>
            <p>1. 🔍 Identity Check - We verify your document</p>
            <p>2. 👤 Face Match - We confirm it's you</p>
            <p>3. ⏳ Under Review - Final verification</p>
            <p>4. ✓ Blue Badge - You're verified!</p>
          </div>

          <button onClick={onClose} className="w-full bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold rounded-full py-2">
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
