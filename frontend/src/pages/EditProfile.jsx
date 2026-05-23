import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { usersApi, uploadApi } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Card } from '../components/ui/card';
import { ArrowLeft, Save, Loader, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

export default function EditProfile() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingCV, setUploadingCV] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    headline: '',
    location: '',
    about: '',
    avatar: '',
    cover: '',
    cv: '',
    skills: [],
    languages: [],
    experience: [],
    education: [],
  });

  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        headline: user.headline || '',
        location: user.location || '',
        about: user.about || '',
        avatar: user.avatar || '',
        cover: user.cover || '',
        cv: user.cv || '',
        skills: user.skills || [],
        languages: user.languages || [],
        experience: user.experience || [],
        education: user.education || [],
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setFormData((prev) => ({
        ...prev,
        skills: [...(prev.skills || []), newSkill.trim()],
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (index) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== index),
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim()) {
      setFormData((prev) => ({
        ...prev,
        languages: [...(prev.languages || []), newLanguage.trim()],
      }));
      setNewLanguage('');
    }
  };

  const removeLanguage = (index) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.filter((_, i) => i !== index),
    }));
  };

  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Basic size guard (10 MB) — Cloudinary free tier handles up to 10 MB images comfortably.
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image is too large (max 10 MB)');
      return;
    }

    const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingCover;
    setUploading(true);
    try {
      const folder = `users/${user.id}/${type}`;
      const res = await uploadApi.uploadFile(file, folder);
      if (!res?.secure_url) throw new Error(res?.error?.message || 'Upload failed');
      setFormData((prev) => ({ ...prev, [type]: res.secure_url }));
      toast.success(`${type === 'avatar' ? 'Profile' : 'Cover'} image uploaded`);
    } catch (err) {
      console.error('Image upload error:', err);
      toast.error(err?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
      // reset input so the same file can be re-selected
      e.target.value = '';
    }
  };

  const handleCVUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // CV size limit: 25 MB (PDF files can be larger)
    if (file.size > 25 * 1024 * 1024) {
      toast.error('CV is too large (max 25 MB)');
      return;
    }

    // Accept PDF and common document formats
    const acceptedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!acceptedTypes.includes(file.type)) {
      toast.error('Only PDF, DOC, DOCX, and TXT files are allowed');
      return;
    }

    setUploadingCV(true);
    try {
      const folder = `users/${user.id}/cv`;
      const res = await uploadApi.uploadFile(file, folder);
      if (!res?.secure_url) throw new Error(res?.error?.message || 'Upload failed');
      setFormData((prev) => ({ ...prev, cv: res.secure_url }));
      toast.success('CV uploaded successfully');
    } catch (err) {
      console.error('CV upload error:', err);
      toast.error(err?.message || 'Failed to upload CV');
    } finally {
      setUploadingCV(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await usersApi.updateMe(formData);
      setUser(updated);
      toast.success('Profile updated successfully!');
      navigate('/me');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/me')}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-3xl font-bold">Edit profile</h1>
      </div>

      {/* Form */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          {/* Profile Photos */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Profile photos</h2>
            <div className="space-y-6">
              {/* Cover Photo */}
              <div>
                <label className="block text-sm font-medium mb-2">Cover photo</label>
                <div className="flex items-center gap-4">
                  {formData.cover ? (
                    <img
                      src={formData.cover}
                      alt="Cover preview"
                      className="h-20 w-40 object-cover rounded border border-gray-200"
                    />
                  ) : (
                    <div className="h-20 w-40 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
                      No cover yet
                    </div>
                  )}
                  <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 ${uploadingCover ? 'opacity-60 pointer-events-none' : ''}`} data-testid="edit-cover-upload-label">
                    {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{uploadingCover ? 'Uploading…' : 'Choose photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'cover')}
                      disabled={uploadingCover}
                      data-testid="edit-cover-input"
                    />
                  </label>
                </div>
              </div>

              {/* Profile Photo */}
              <div>
                <label className="block text-sm font-medium mb-2">Profile photo</label>
                <div className="flex items-center gap-4">
                  <img
                    src={formData.avatar}
                    alt="Avatar preview"
                    className="h-24 w-24 object-cover object-center rounded-full border-4 border-white shadow-md bg-gray-50"
                    data-testid="edit-avatar-preview"
                  />
                  <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 ${uploadingAvatar ? 'opacity-60 pointer-events-none' : ''}`} data-testid="edit-avatar-upload-label">
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    <span>{uploadingAvatar ? 'Uploading…' : 'Choose photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, 'avatar')}
                      disabled={uploadingAvatar}
                      data-testid="edit-avatar-input"
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Square images work best. Your profile picture is uploaded independently of the cover photo.
                </p>
              </div>
            </div>
          </Card>

          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Basic information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Headline</label>
                <Input
                  name="headline"
                  value={formData.headline}
                  onChange={handleChange}
                  placeholder="e.g., Software Engineer at Company"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Location</label>
                <Input
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="City, Country"
                  className="w-full"
                />
              </div>
            </div>
          </Card>

          {/* CV Upload */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Curriculum Vitae (CV)</h2>
            <p className="text-sm text-gray-600 mb-4">Upload your CV to share with employers when applying for jobs</p>
            <div className="flex items-center gap-4">
              {formData.cv ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-lg flex-1">
                  <div className="w-10 h-10 rounded bg-green-100 flex items-center justify-center text-xs font-semibold text-green-700">
                    {formData.cv.split('.').pop().toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">CV uploaded</p>
                    <a href={formData.cv} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">
                      View CV
                    </a>
                  </div>
                  <button
                    onClick={() => setFormData((prev) => ({ ...prev, cv: '' }))}
                    className="text-green-600 hover:text-green-800 font-bold"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className={`cursor-pointer flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 ${uploadingCV ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploadingCV ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>{uploadingCV ? 'Uploading…' : 'Upload CV'}</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={handleCVUpload}
                    disabled={uploadingCV}
                  />
                </label>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Supported formats: PDF, DOC, DOCX, TXT (max 25 MB)</p>
          </Card>

          {/* About */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">About</h2>
            <Textarea
              name="about"
              value={formData.about}
              onChange={handleChange}
              placeholder="Tell people about your professional journey..."
              rows={6}
              className="w-full"
            />
          </Card>

          {/* Skills */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Skills</h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill"
                onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                className="flex-1"
              />
              <Button onClick={addSkill}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.skills?.map((skill) => (
                <div key={skill} className="flex items-center gap-2 bg-blue-100 px-3 py-1 rounded-full text-sm">
                  {skill}
                  <button
                    onClick={() => removeSkill(formData.skills.indexOf(skill))}
                    className="text-blue-600 hover:text-blue-800 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Languages */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Languages</h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                placeholder="Add a language"
                onKeyDown={(e) => e.key === 'Enter' && addLanguage()}
                className="flex-1"
              />
              <Button onClick={addLanguage}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.languages?.map((lang) => (
                <div key={lang} className="flex items-center gap-2 bg-green-100 px-3 py-1 rounded-full text-sm">
                  {lang}
                  <button
                    onClick={() => removeLanguage(formData.languages.indexOf(lang))}
                    className="text-green-600 hover:text-green-800 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </Card>

          {/* Save Button */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={loading || uploadingAvatar || uploadingCover}
              className="flex items-center gap-2"
              data-testid="edit-profile-save"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/me')}
            >
              Cancel
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="hidden lg:block lg:col-span-4">
          <Card className="p-6 sticky top-20">
            <h3 className="font-semibold mb-4">Preview</h3>
            <div className="space-y-2 text-sm">
              <p className="font-bold text-lg">{formData.name}</p>
              <p className="text-gray-600">{formData.headline}</p>
              <p className="text-gray-600 flex items-center gap-1">
                📍 {formData.location || 'Location not set'}
              </p>
              {formData.about && (
                <p className="text-gray-700 text-xs mt-2 line-clamp-3">{formData.about}</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
