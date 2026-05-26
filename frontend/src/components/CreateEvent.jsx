import React, { useState, useEffect } from 'react';
import { Loader2, X, MapPin, Calendar, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { uploadApi } from '../api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from './ui/dialog';

export default function CreateEvent() {
  const { user, addPost, createContentType, setCreateContentType } = useApp();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [image, setImage] = useState('');
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (createContentType === 'event') {
      setOpen(true);
    }
  }, [createContentType]);

  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (!newOpen) {
      setCreateContentType(null);
      setTitle('');
      setDescription('');
      setLocation('');
      setDate('');
      setTime('');
      setImage('');
    }
  };

  const handleFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const r = await uploadApi.uploadFile(f, `events/${user.id}`);
      if (r.secure_url) {
        setImage(r.secure_url);
        toast.success('Image uploaded');
      } else {
        console.error('Cloudinary response:', r);
        throw new Error(r.error?.message || 'Upload failed: No URL returned');
      }
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }
    if (!date) {
      toast.error('Please select a date');
      return;
    }

    setPosting(true);
    const titleToSend = title.trim();
    const descriptionToSend = description.trim();
    const locationToSend = location.trim();
    const imageUrl = image && image.length > 0 ? image : null;

    try {
      // Create event as a special post with event details
      const eventContent = `📅 **${titleToSend}**
${date}${time ? ` at ${time}` : ''}
${locationToSend ? `📍 ${locationToSend}` : ''}

${descriptionToSend}`;

      await addPost(eventContent, imageUrl, null);
      setTitle('');
      setDescription('');
      setLocation('');
      setDate('');
      setTime('');
      setImage('');
      setOpen(false);
      setCreateContentType(null);
      toast.success('Event created successfully');
    } catch (e) {
      console.error('Event error:', e);
      let errorMsg = 'Failed to create event';

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
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create an Event</DialogTitle>
          <DialogClose asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <img src={user?.avatar} alt={user?.name} className="w-10 h-10 rounded-full object-cover" />
            <div>
              <p className="font-semibold text-sm">{user?.name}</p>
              <p className="text-xs text-gray-600">Creating as your profile</p>
            </div>
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Event title"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c37d16]"
            disabled={posting}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c37d16]"
                disabled={posting}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c37d16]"
                disabled={posting}
              />
            </div>
          </div>

          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Event location (optional)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c37d16]"
            disabled={posting}
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Event description (optional)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#c37d16] min-h-[150px] resize-none"
            disabled={posting}
          />

          {image && (
            <div className="relative">
              <img src={image} alt="Event cover" className="w-full h-48 object-cover rounded-lg" />
              <button
                onClick={() => setImage('')}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-50">
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  🖼️ Add event image
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                disabled={uploading || posting}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => handleOpenChange(false)}
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-full"
              disabled={posting}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={posting}
              className="px-4 py-2 bg-[#c37d16] text-white text-sm font-semibold rounded-full hover:bg-[#9d6410] disabled:opacity-50"
            >
              {posting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Creating...
                </>
              ) : (
                'Create Event'
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
