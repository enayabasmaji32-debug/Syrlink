import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Image, Video, CalendarDays, FileText, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { uploadApi } from '../api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

export default function CreatePost({ companyId = null, companyName = null, companyLogo = null, companyOwnerId = null }) {
  const { user, addPost, ownedCompanies, activeCompany, setActiveCompany, createContentType, setCreateContentType } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [image, setImage] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const canPostAsCompany = Boolean(companyId && (user?.is_admin || user?.id === companyOwnerId));
  const [selectedCompanyId, setSelectedCompanyId] = useState(canPostAsCompany ? companyId : activeCompany?.id || '');
  // Store company info from props for when company is not in ownedCompanies yet
  const [passedCompanyInfo, setPassedCompanyInfo] = useState(canPostAsCompany ? { id: companyId, name: companyName, logo: companyLogo } : null);

  useEffect(() => {
    if (companyId && canPostAsCompany) {
      setSelectedCompanyId(companyId);
      setPassedCompanyInfo({ id: companyId, name: companyName, logo: companyLogo });
      setActiveCompany(companyId);
    } else {
      setSelectedCompanyId(activeCompany?.id || '');
      setPassedCompanyInfo(null);
    }
  }, [activeCompany, canPostAsCompany, companyId, companyName, companyLogo, setActiveCompany]);

  // Handle content type changes from global state
  useEffect(() => {
    if (createContentType === 'post') {
      setOpen(true);
    }
  }, [createContentType]);

  // Close modal and reset content type when modal closes
  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (!newOpen) {
      setCreateContentType(null);
    }
  };

  const selectedCompany = ownedCompanies?.find((c) => c.id === selectedCompanyId) || passedCompanyInfo || null;

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const r = await uploadApi.uploadFile(f, `posts/${user.id}`);
      if (r.secure_url) { 
        setImage(r.secure_url); 
        toast.success('Image uploaded'); 
      }
      else {
        console.error('Cloudinary response:', r);
        throw new Error(r.error?.message || 'Upload failed: No URL returned');
      }
    } catch (err) { 
      console.error('Upload error:', err);
      toast.error(err.message || 'Upload failed'); 
    }
    finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!text.trim()) {
      toast.error('Please write something');
      return;
    }

    setPosting(true);
    const contentToSend = text.trim();
    const imageUrl = image && image.length > 0 ? image : null;
    try {
      const companyToSend = companyId || selectedCompanyId || null;
      await addPost(contentToSend, imageUrl, companyToSend);
      setText('');
      setImage('');
      setOpen(false);
      toast.success('Post published successfully');
    } catch (e) {
      console.error('Post error:', e);
      let errorMsg = 'Failed to post';
      
      if (e?.code === 'ECONNABORTED') {
        errorMsg = 'Server is taking too long. Please check your connection and try again.';
      } else if (e?.response?.status === 413) {
        errorMsg = 'Image is too large. Please use a smaller image.';
      } else if (e?.response?.status === 408 || e?.code === 'ETIMEDOUT') {
        errorMsg = 'Request timed out. Please try again.';
      } else if (!e?.response) {
        errorMsg = 'Network error. Please check your connection.';
      } else {
        errorMsg = e?.response?.data?.detail || e?.message || errorMsg;
      }
      
      toast.error(errorMsg);
    }
    finally {
      setPosting(false);
    }
  };

  return (
    <section className="li-card p-3">
      <div className="flex items-center gap-2">
        <img src={user?.avatar} alt={user?.name} className="w-12 h-12 rounded-full object-cover" />
        <button
          onClick={() => setOpen(true)}
          className="flex-1 text-left border border-gray-300 rounded-full px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100"
          data-testid="create-post-trigger"
        >
          Start a post
        </button>
      </div>
      <div className="flex items-center justify-around mt-2 text-sm font-semibold text-gray-600">
        <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1.5" onClick={() => setOpen(true)}>
          <Image className="w-5 h-5 text-[#378fe9]" /> Photo
        </button>
        <div className="flex flex-col items-center gap-0.5">
          <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1.5 opacity-50 cursor-not-allowed" disabled>
            <Video className="w-5 h-5 text-[#5f9b41]" /> Video
          </button>
          <span className="text-[10px] text-gray-500">قريباً</span>
        </div>
        <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1.5" onClick={() => setOpen(true)}>
          <CalendarDays className="w-5 h-5 text-[#c37d16]" /> Event
        </button>
        <button className="flex items-center gap-1 hover:bg-gray-100 rounded px-3 py-1.5" onClick={() => setOpen(true)}>
          <FileText className="w-5 h-5 text-[#e16745]" /> Article
        </button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <img src={selectedCompany?.logo || user?.avatar} alt={selectedCompany?.name || user?.name} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <DialogTitle className="text-sm">{selectedCompany?.name || user?.name}</DialogTitle>
                <p className="text-xs text-gray-600">
                  Posting as {selectedCompany ? selectedCompany.name : 'your profile'}
                </p>
              </div>
            </div>
          </DialogHeader>
          {ownedCompanies?.length > 0 && (
            <div className="flex items-center justify-between gap-3 mb-3">
              <label className="text-xs font-semibold text-gray-500">Post as</label>
              <select
                value={selectedCompanyId}
                onChange={(e) => {
                  setSelectedCompanyId(e.target.value);
                  setActiveCompany(e.target.value);
                }}
                className="border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">Your profile</option>
                {ownedCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="What do you want to talk about?"
            className="w-full p-2 text-sm focus:outline-none resize-none border rounded"
            data-testid="create-post-textarea"
          />
          
          <div className="flex items-center gap-2 mt-3">
            <label className="text-xs font-semibold text-[#0a66c2] cursor-pointer hover:underline flex items-center gap-1" data-testid="create-post-file-label">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3" />}
              {uploading ? 'Uploading…' : 'Upload from device'}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} data-testid="create-post-file" />
            </label>
            {image && <img src={image} alt="" className="h-10 w-10 object-cover rounded border" />}
          </div>
          
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setOpen(false)}
              className="text-gray-600 text-sm font-semibold rounded-full px-5 py-1.5 hover:bg-gray-200 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!text.trim() || posting || uploading}
              className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-full px-5 py-1.5 flex items-center gap-2 transition-all"
              data-testid="create-post-submit"
            >
              {posting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Posting…
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                'Post'
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

CreatePost.propTypes = {
  companyId: PropTypes.string,
  companyName: PropTypes.string,
  companyLogo: PropTypes.string,
  companyOwnerId: PropTypes.string,
};
