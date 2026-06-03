import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { verificationApi, uploadApi } from '../api';
import { ShieldCheck, Upload, CheckCircle2, ArrowRight, Lock, Camera, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import BiometricLiveness from './BiometricLiveness';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

export default function VerificationRequest({ onClose }) {
  const { user } = useApp();
  const [step, setStep] = useState(1);
  const [idFront, setIdFront] = useState(null);
  const [idFrontPreview, setIdFrontPreview] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [idBackPreview, setIdBackPreview] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestId, setRequestId] = useState(null);

  const handleFileChange = (e, type) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result;
        console.log(`[${type}] File loaded:`, { fileName: f.name, size: f.size, preview: result ? 'set' : 'null' });
        if (type === 'idFront') {
          setIdFront(f);
          setIdFrontPreview(result);
        } else if (type === 'idBack') {
          setIdBack(f);
          setIdBackPreview(result);
          console.log('[idBack] State updated - idBackPreview should now be:', result ? 'loaded' : 'null');
        } else if (type === 'selfie') {
          setSelfie(f);
          setSelfiePreview(result);
        }
      };
      reader.readAsDataURL(f);
    } else {
      console.warn(`No file selected for ${type}`);
    }
  };

  const uploadFile = async (file) => {
    const up = await uploadApi.uploadFile(file, `verification/${user.id}`);
    if (!up.secure_url) throw new Error('Upload failed');
    return up.secure_url;
  };

  const submit = async () => {
    if (!idFront || !idBack || !selfie) {
      toast.error('Please upload all required documents');
      return;
    }
    setSubmitting(true);
    try {
      const idFrontUrl = await uploadFile(idFront);
      const idBackUrl = await uploadFile(idBack);
      const selfieUrl = await uploadFile(selfie);
      
      const result = await verificationApi.submit({
        id_front: idFrontUrl,
        document_url: idFrontUrl,
        document_type: 'id_front',
        id_back: idBackUrl,
        selfie: selfieUrl,
        note,
      });
      setRequestId(result.request_id);
      setStep(5);
      toast.success('Verification request submitted ✓');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit request');
      setSubmitting(false);
    }
  };

  // ===== Helper: Progress Bar =====
  const renderProgressBar = () => {
    const steps = [
      { num: 1, label: 'ID Front' },
      { num: 2, label: 'ID Back' },
      { num: 3, label: 'Live Selfie' },
      { num: 4, label: 'Review' },
      { num: 5, label: 'Submit' },
    ];
    return (
      <div className="space-y-2 mb-8">
        <div className="flex gap-1">
          {steps.map((s) => (
            <div key={s.num} className="flex-1">
              <div className={`h-2 rounded-full transition ${s.num <= step ? 'bg-gradient-to-r from-[#0a66c2] to-[#005ba1]' : 'bg-gray-300'}`} />
            </div>
          ))}
        </div>
        <div className="flex gap-1 text-xs font-semibold text-gray-600">
          {steps.map((s) => (
            <div key={s.num} className="flex-1 text-center">
              <span className={s.num <= step ? 'text-[#0a66c2] text-lg' : 'text-gray-400 text-lg'}>●</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ===== STEP 1: ID Front =====
  if (step === 1) {
    return (
      <Dialog key="step-1-dialog" open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-[#0a66c2] to-[#005ba1] text-white rounded-lg -mx-6 -mt-6 px-6 py-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6" />
                <div>
                  <DialogTitle className="text-white">Professional Verification</DialogTitle>
                  <p className="text-xs text-blue-100 mt-1">Global Standard Verification System</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">1/5</div>
              </div>
            </div>
          </DialogHeader>

          <DialogDescription className="sr-only">
            Step 1 of 5: Upload the front side of your ID document for verification
          </DialogDescription>

          {renderProgressBar()}

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Upload ID - Front Side</h3>
              <p className="text-sm text-gray-600">Clear, well-lit photo of your ID card or passport front page</p>
            </div>

            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'idFront')}
                id="id-front-upload"
                className="hidden"
              />
              <label
                htmlFor="id-front-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-[#0a66c2] rounded-xl p-10 hover:bg-gradient-to-b hover:from-blue-50 hover:to-transparent cursor-pointer transition bg-gradient-to-b from-blue-50 to-transparent"
              >
                <FileText className="w-12 h-12 text-[#0a66c2] mb-3" />
                <p className="text-sm font-bold text-gray-900">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG (up to 10MB)</p>
              </label>
            </div>

            {idFrontPreview && (
              <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-800">✓ ID Front Uploaded Successfully</p>
                </div>
                <img 
                  src={idFrontPreview} 
                  alt="ID Front Preview" 
                  className="max-h-40 rounded-lg w-full object-cover border border-green-300" 
                  onLoad={() => console.log('[idFront] Image loaded in DOM')}
                  onError={(e) => console.error('[idFront] Image failed to load:', e)}
                />
              </div>
            )}
            
            {!idFrontPreview && (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>Waiting for image upload...</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-800"><Lock className="w-4 h-4 inline mr-2" /><strong>Your data is encrypted and secure</strong></p>
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold rounded-full py-3 hover:bg-gray-100 transition">
                Cancel
              </button>
              <button
                onClick={() => idFront && setStep(2)}
                disabled={!idFront}
                className="flex-1 bg-gradient-to-r from-[#0a66c2] to-[#005ba1] hover:shadow-lg disabled:opacity-50 text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2 transition"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 2: ID Back =====
  if (step === 2) {
    return (
      <Dialog key="step-2-dialog" open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-[#0a66c2] to-[#005ba1] text-white rounded-lg -mx-6 -mt-6 px-6 py-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6" />
                <div>
                  <DialogTitle className="text-white">Professional Verification</DialogTitle>
                  <p className="text-xs text-blue-100 mt-1">Global Standard Verification System</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">2/5</div>
              </div>
            </div>
          </DialogHeader>

          <DialogDescription className="sr-only">
            Step 2 of 5: Upload the back side of your ID document for verification
          </DialogDescription>

          {renderProgressBar()}

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Upload ID - Back Side</h3>
              <p className="text-sm text-gray-600">Clear, well-lit photo of your ID card or passport back page</p>
            </div>

            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange(e, 'idBack')}
                id="id-back-upload"
                className="hidden"
              />
              <label
                htmlFor="id-back-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-[#0a66c2] rounded-xl p-10 hover:bg-gradient-to-b hover:from-blue-50 hover:to-transparent cursor-pointer transition bg-gradient-to-b from-blue-50 to-transparent"
              >
                <FileText className="w-12 h-12 text-[#0a66c2] mb-3" />
                <p className="text-sm font-bold text-gray-900">Click to upload or drag and drop</p>
                <p className="text-xs text-gray-600 mt-1">PNG, JPG (up to 10MB)</p>
              </label>
            </div>

            {idBackPreview && (
              <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <p className="text-sm font-semibold text-green-800">✓ ID Back Uploaded Successfully</p>
                </div>
                <img 
                  src={idBackPreview} 
                  alt="ID Back Preview" 
                  className="max-h-40 rounded-lg w-full object-cover border border-green-300" 
                  onLoad={() => console.log('[idBack] Image loaded in DOM')}
                  onError={(e) => console.error('[idBack] Image failed to load:', e)}
                />
              </div>
            )}
            
            {!idBackPreview && (
              <div className="text-center py-4 text-gray-500 text-sm">
                <p>Waiting for image upload...</p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-800"><Lock className="w-4 h-4 inline mr-2" /><strong>Your data is encrypted and secure</strong></p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold rounded-full py-3 hover:bg-gray-100 transition">
                Back
              </button>
              <button
                onClick={() => idBack && setStep(3)}
                disabled={!idBack}
                className="flex-1 bg-gradient-to-r from-[#0a66c2] to-[#005ba1] hover:shadow-lg disabled:opacity-50 text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2 transition"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 3: Biometric Liveness Test =====
  if (step === 3) {
    const handleLivenessComplete = (file) => {
      setSelfie(file);
      setSelfiePreview(URL.createObjectURL(file));
      toast.success('✓ Biometric liveness verification complete!');
      setStep(4);
    };

    return (
      <Dialog key="step-3-dialog" open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-[#0a66c2] to-[#005ba1] text-white rounded-lg -mx-6 -mt-6 px-6 py-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6" />
                <div>
                  <DialogTitle className="text-white">Professional Verification</DialogTitle>
                  <p className="text-xs text-blue-100 mt-1">Global Standard Verification System</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">3/5</div>
              </div>
            </div>
          </DialogHeader>

          <DialogDescription className="sr-only">
            Step 3 of 5: Complete biometric liveness detection with real-time face recognition
          </DialogDescription>

          {renderProgressBar()}

          <BiometricLiveness 
            onComplete={handleLivenessComplete}
            onBack={() => setStep(2)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 4: Review =====
  if (step === 4) {
    return (
      <Dialog key="step-4-dialog" open={true} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="bg-gradient-to-r from-[#0a66c2] to-[#005ba1] text-white rounded-lg -mx-6 -mt-6 px-6 py-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6" />
                <div>
                  <DialogTitle className="text-white">Professional Verification</DialogTitle>
                  <p className="text-xs text-blue-100 mt-1">Global Standard Verification System</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">4/5</div>
              </div>
            </div>
          </DialogHeader>

          <DialogDescription className="sr-only">
            Step 4 of 5: Review your uploaded documents and biometric data before submission
          </DialogDescription>

          {renderProgressBar()}

          <div className="space-y-6">
            <h3 className="text-lg font-bold text-gray-900">Review Your Information</h3>

            {/* ID Front Review */}
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-gray-900">ID - Front</p>
              </div>
              {idFrontPreview && <img src={idFrontPreview} alt="ID Front" className="max-h-32 rounded-lg w-full object-cover" />}
            </div>

            {/* ID Back Review */}
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-gray-900">ID - Back</p>
              </div>
              {idBackPreview && <img src={idBackPreview} alt="ID Back" className="max-h-32 rounded-lg w-full object-cover" />}
            </div>

            {/* Selfie Review */}
            <div className="border-2 border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-gray-900">Live Selfie</p>
              </div>
              {selfiePreview && <img src={selfiePreview} alt="Selfie" className="max-h-32 rounded-lg w-full object-cover" />}
            </div>

            {/* Additional Notes */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Additional Notes (Optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any notes about your verification..."
                rows={3}
                className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-[#0a66c2] focus:outline-none"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-800"><Lock className="w-4 h-4 inline mr-2" /><strong>Your data is encrypted and secure</strong></p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold rounded-full py-3 hover:bg-gray-100 transition">
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 bg-gradient-to-r from-[#0a66c2] to-[#005ba1] hover:shadow-lg text-white font-semibold rounded-full py-3 flex items-center justify-center gap-2 transition"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ===== STEP 5: Submit & Confirmation =====
  return (
    <Dialog key="step-5-dialog" open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg -mx-6 -mt-6 px-6 py-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" />
              <div>
                <DialogTitle className="text-white">Verification Submitted!</DialogTitle>
                <p className="text-xs text-green-100 mt-1">Your request is under review</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">5/5</div>
            </div>
          </div>
        </DialogHeader>

        <DialogDescription className="sr-only">
          Step 5 of 5: Your verification request has been submitted successfully
        </DialogDescription>

        {renderProgressBar()}

        <div className="space-y-6 text-center py-4">
          <div className="space-y-2">
            <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-green-50 rounded-full flex items-center justify-center mx-auto border-2 border-green-200">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">Great!</h3>
            <p className="text-sm text-gray-600">Your verification request has been submitted successfully</p>
          </div>

          {requestId && (
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-[#0a66c2] space-y-2">
              <p className="text-xs text-gray-700"><strong>Your Global Request ID:</strong></p>
              <p className="text-2xl font-mono font-bold text-[#0a66c2] tracking-widest">{requestId}</p>
              <p className="text-xs text-gray-600">Save this ID. Our team will review within 24-48 hours.</p>
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-5 space-y-3 text-left border-l-4 border-[#0a66c2]">
            <p className="font-bold text-gray-900">📋 Verification Stages:</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-3">
                <span className="text-lg">🔍</span>
                <div>
                  <p className="font-semibold text-gray-900">Identity Check</p>
                  <p className="text-xs text-gray-600">We verify your ID documents</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">●</span>
                <div>
                  <p className="font-semibold text-gray-900">Face Match</p>
                  <p className="text-xs text-gray-600">We match your selfie with ID</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">▸</span>
                <div>
                  <p className="font-semibold text-gray-900">Liveness Check</p>
                  <p className="text-xs text-gray-600">We verify the selfie is genuine</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">▪</span>
                <div>
                  <p className="font-semibold text-gray-900">Under Review</p>
                  <p className="text-xs text-gray-600">Final verification process</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">✓</span>
                <div>
                  <p className="font-semibold text-gray-900">Final Decision</p>
                  <p className="text-xs text-gray-600">You get your verification badge</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs text-amber-800"><strong>⏱ Processing Time:</strong> Most verifications are completed within 24-48 hours. You'll receive a notification when your status changes.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-800"><Lock className="w-4 h-4 inline mr-2" /><strong>Your data is encrypted and secure. We never store raw photos.</strong></p>
          </div>

          <button onClick={onClose} className="w-full bg-gradient-to-r from-[#0a66c2] to-[#005ba1] hover:shadow-lg text-white font-semibold rounded-full py-3 transition">
            Continue to Profile
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
