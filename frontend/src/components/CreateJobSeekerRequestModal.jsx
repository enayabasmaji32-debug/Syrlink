import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { jobsApi } from '../api';
import { toast } from 'sonner';

export default function CreateJobSeekerRequestModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    skills: '',
    qualifications: '',
    contact_number: '',
    desired_salary: '',
    salary_currency: 'USD',
    location: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'desired_salary' ? parseFloat(value) || '' : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.title.trim()) {
      toast.error('Job title is required');
      return;
    }
    if (!formData.skills.trim()) {
      toast.error('Skills are required');
      return;
    }
    if (!formData.qualifications.trim()) {
      toast.error('Qualifications are required');
      return;
    }
    if (!formData.contact_number.trim()) {
      toast.error('Contact number is required');
      return;
    }

    // Convert skills string to array
    const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(s => s);
    if (skillsArray.length === 0) {
      toast.error('Please enter at least one skill');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        skills: skillsArray,
      };
      await jobsApi.createSeekerRequest(payload);
      toast.success('Job seeker request posted successfully!');
      setFormData({
        title: '',
        skills: '',
        qualifications: '',
        contact_number: '',
        desired_salary: '',
        salary_currency: 'USD',
        location: '',
      });
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to post job seeker request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between shrink-0">
          <h2 className="text-lg sm:text-xl font-bold">I'm Looking for a Job</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 sm:p-2 hover:bg-gray-100 rounded-full shrink-0"
          >
            <X className="w-4 sm:w-5 h-4 sm:h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-3 sm:space-y-4">
          {/* Job Title / Position */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              What position are you looking for? *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Frontend Engineer, Product Designer"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Skills */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Your Skills * (comma-separated)
            </label>
            <textarea
              name="skills"
              value={formData.skills}
              onChange={handleInputChange}
              placeholder="e.g., React, TypeScript, Node.js, UI Design"
              rows="2"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 resize-none"
              disabled={loading}
            />
            <p className="text-[11px] sm:text-xs text-gray-500 mt-1">Separate skills with commas</p>
          </div>

          {/* Qualifications */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Your Qualifications & Experience *
            </label>
            <textarea
              name="qualifications"
              value={formData.qualifications}
              onChange={handleInputChange}
              placeholder="e.g., BS Computer Science, 3 years in web development, certifications..."
              rows="3"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 resize-none"
              disabled={loading}
            />
          </div>

          {/* Contact Number */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Contact Number *
            </label>
            <input
              type="tel"
              name="contact_number"
              value={formData.contact_number}
              onChange={handleInputChange}
              placeholder="e.g., +963912345678"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Preferred Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Damascus, Syria or Remote"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Desired Salary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
                Desired Salary
              </label>
              <input
                type="number"
                name="desired_salary"
                value={formData.desired_salary}
                onChange={handleInputChange}
                placeholder="e.g., 40000"
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                disabled={loading}
                min="0"
                step="1000"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
                Currency
              </label>
              <select
                name="salary_currency"
                value={formData.salary_currency}
                onChange={handleInputChange}
                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                disabled={loading}
              >
                <option value="USD">USD ($)</option>
                <option value="LBP">LBP (ل.ل)</option>
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-2 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#0a66c2] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#004182] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                  Posting...
                </>
              ) : (
                'Post Request'
              )}
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-gray-500 text-center">
            Your request will be visible to companies looking for talent with your skills and experience.
          </p>
        </form>
      </div>
    </div>
  );
}
