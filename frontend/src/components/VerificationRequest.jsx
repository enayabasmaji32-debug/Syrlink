import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { verificationApi, uploadApi } from '../api';
import { ShieldCheck, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export default function VerificationRequest({ onClose }) {
  const { user } = useApp();
  const [docType, setDocType] = useState('id');
  const [note, setNote] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!file) { toast.error('Please choose a document'); return; }
    setSubmitting(true);
    try {
      const up = await uploadApi.uploadFile(file, `verification/${user.id}`);
      if (!up.secure_url) throw new Error('upload failed');
      await verificationApi.submit({ document_url: up.secure_url, document_type: docType, note });
      toast.success('Verification request submitted ✓ — admin will review soon.');
      onClose?.();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Could not submit request');
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#0a66c2]" />
            <DialogTitle>Request Verification</DialogTitle>
          </div>
          <p className="text-xs text-gray-600 mt-2">Upload an ID, diploma, or work certificate to get a blue badge ✓.</p>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Document type</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)} data-testid="verif-type"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
              <option value="id">National ID / Passport</option>
              <option value="experience">Work certificate</option>
              <option value="education">Diploma / Degree</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Document (image)</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])} data-testid="verif-file"
              className="w-full text-sm" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1">Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} data-testid="verif-note"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>

          <button onClick={submit} disabled={submitting || !file} data-testid="verif-submit"
            className="w-full bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white font-semibold rounded-full py-2 text-sm flex items-center justify-center gap-1">
            <Upload className="w-4 h-4" /> {submitting ? 'Uploading…' : 'Submit for review'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
