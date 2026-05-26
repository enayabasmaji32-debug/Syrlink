import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { X, Loader2, Upload } from 'lucide-react';
import { companiesApi, uploadApi } from '../api';
import { toast } from 'sonner';

export default function CreateCompanyModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    registration_number: '',
    employees_count: '',
    owner_name: '',
    ceo_name: '',
    website: '',
    location: '',
    tagline: '',
    about: '',
    logo: '',
    cover: '',
    commercial_registry_image: '',
    is_looking_for_investors: '',
    valuation: '',
    investment_type: '',
    funding_amount: '',
    company_status: '',
    available_equity: '',
    funding_round_status: '',
  });

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    if (name === 'is_looking_for_investors') {
      setFormData(prev => ({
        ...prev,
        [name]: value === 'yes',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: ['employees_count', 'valuation', 'funding_amount', 'available_equity'].includes(name) ? (value === '' ? '' : Number(value)) : value,
      }));
    }
  };

  const uploadImage = async (file, field) => {
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadApi.uploadFile(file, 'companies/');
      if (result.secure_url) {
        setFormData(prev => ({
          ...prev,
          [field]: result.secure_url,
        }));
        toast.success('Image uploaded successfully');
      }
    } catch (error) {
      if (error && error.message) {
        toast.error(error.message);
      } else {
        toast.error('Failed to upload image');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadImage(file, field);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!formData.industry.trim()) {
      toast.error('Industry is required');
      return;
    }
    if (!formData.registration_number.trim()) {
      toast.error('Registration number is required');
      return;
    }
    if (!formData.employees_count) {
      toast.error('Number of employees is required');
      return;
    }
    if (!formData.owner_name.trim()) {
      toast.error('Owner name is required');
      return;
    }
    if (!formData.ceo_name.trim()) {
      toast.error('CEO name is required');
      return;
    }
    if (!formData.commercial_registry_image) {
      toast.error('Commercial registry image is required');
      return;
    }

    setLoading(true);
    try {
      // Clean up empty values before sending
      const cleanedData = {
        ...formData,
        valuation: formData.valuation ? parseFloat(formData.valuation) : null,
        funding_amount: formData.funding_amount ? parseFloat(formData.funding_amount) : null,
        available_equity: formData.available_equity ? parseFloat(formData.available_equity) : null,
        investment_type: formData.investment_type?.trim() || '',
        company_status: formData.company_status?.trim() || '',
        funding_round_status: formData.funding_round_status?.trim() || '',
      };
      await companiesApi.requestCreation(cleanedData);
      toast.success("Thank you — we've received your request. We'll review it for approval.");
      setFormData({
        name: '',
        industry: '',
        registration_number: '',
        employees_count: '',
        owner_name: '',
        ceo_name: '',
        website: '',
        location: '',
        tagline: '',
        about: '',
        logo: '',
        cover: '',
        commercial_registry_image: '',
        is_looking_for_investors: '',
        valuation: '',
        investment_type: '',
        funding_amount: '',
        company_status: '',
        available_equity: '',
        funding_round_status: '',
      });
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit company request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-6 flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold">Create Company</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-full shrink-0"
          >
            <X className="w-4 sm:w-5 h-4 sm:h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-6 space-y-4">
          {/* Company Name */}
          <div>
            <label htmlFor="company-name" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Company Name *
            </label>
            <input
              id="company-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter company name"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Industry */}
          <div>
            <label htmlFor="company-industry" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Industry *
            </label>
            <input
              id="company-industry"
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleInputChange}
              placeholder="e.g., Technology, Finance, Healthcare"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Registration Number */}
          <div>
            <label htmlFor="company-registration-number" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Registration Number *
            </label>
            <input
              id="company-registration-number"
              type="text"
              name="registration_number"
              value={formData.registration_number}
              onChange={handleInputChange}
              placeholder="Enter registration number"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Employees Count */}
          <div>
            <label htmlFor="company-employees-count" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Number of Employees *
            </label>
            <input
              id="company-employees-count"
              type="number"
              name="employees_count"
              value={formData.employees_count}
              onChange={handleInputChange}
              placeholder="Enter number of employees"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
              min="0"
            />
          </div>

          {/* Owner Name */}
          <div>
            <label htmlFor="company-owner-name" className="block text-sm font-semibold text-gray-900 mb-1">
              Owner Name *
            </label>
            <input
              id="company-owner-name"
              type="text"
              name="owner_name"
              value={formData.owner_name}
              onChange={handleInputChange}
              placeholder="Enter owner's full name"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* CEO Name */}
          <div>
            <label htmlFor="company-ceo-name" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              CEO Name *
            </label>
            <input
              id="company-ceo-name"
              type="text"
              name="ceo_name"
              value={formData.ceo_name}
              onChange={handleInputChange}
              placeholder="Enter CEO's full name"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Website */}
          <div>
            <label htmlFor="company-website" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Website
            </label>
            <input
              id="company-website"
              type="url"
              name="website"
              value={formData.website}
              onChange={handleInputChange}
              placeholder="https://example.com"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="company-location" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Location
            </label>
            <input
              id="company-location"
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Damascus, Syria"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Investment */}
          <div>
            <label className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Are you looking for investors? *</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-1 text-xs sm:text-sm">
                <input
                  type="radio"
                  name="is_looking_for_investors"
                  value="yes"
                  checked={formData.is_looking_for_investors === true}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
                Yes
              </label>
              <label className="flex items-center gap-1 text-xs sm:text-sm">
                <input
                  type="radio"
                  name="is_looking_for_investors"
                  value="no"
                  checked={formData.is_looking_for_investors === false}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                />
                No
              </label>
            </div>
          </div>

          {/* Additional Investment Fields */}
          {formData.is_looking_for_investors === true && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border rounded-lg p-3 sm:p-4 my-2 bg-gray-50">
              <div>
                <label htmlFor="valuation" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Estimated Company Valuation</label>
                <input
                  id="valuation"
                  type="number"
                  name="valuation"
                  value={formData.valuation}
                  onChange={handleInputChange}
                  placeholder="e.g. 1000000"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                  disabled={loading}
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="investment_type" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Type of Investment Needed</label>
                <input
                  id="investment_type"
                  type="text"
                  name="investment_type"
                  value={formData.investment_type}
                  onChange={handleInputChange}
                  placeholder="e.g. Equity, Debt, Convertible Note"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="funding_amount" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Requested Funding Amount</label>
                <input
                  id="funding_amount"
                  type="number"
                  name="funding_amount"
                  value={formData.funding_amount}
                  onChange={handleInputChange}
                  placeholder="e.g. 50000"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                  disabled={loading}
                  min="0"
                />
              </div>
              <div>
                <label htmlFor="company_status" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Current Company Status</label>
                <input
                  id="company_status"
                  type="text"
                  name="company_status"
                  value={formData.company_status}
                  onChange={handleInputChange}
                  placeholder="e.g. Growth stage, Expansion, ..."
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="available_equity" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Available Equity for Investment (%)</label>
                <input
                  id="available_equity"
                  type="number"
                  name="available_equity"
                  value={formData.available_equity}
                  onChange={handleInputChange}
                  placeholder="e.g. 10"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                  disabled={loading}
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label htmlFor="funding_round_status" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">Funding Round Status</label>
                <input
                  id="funding_round_status"
                  type="text"
                  name="funding_round_status"
                  value={formData.funding_round_status}
                  onChange={handleInputChange}
                  placeholder="e.g. Seed, Series A, ..."
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                  disabled={loading}
                />
              </div>
            </div>
          )}
          <div>
            <label htmlFor="company-tagline" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              Tagline
            </label>
            <input
              id="company-tagline"
              type="text"
              name="tagline"
              value={formData.tagline}
              onChange={handleInputChange}
              placeholder="Short company description"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="company-logo" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
                Company Logo
              </label>
              <input
                id="company-logo"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'logo')}
                className="w-full text-xs sm:text-sm"
                disabled={loading || uploading}
              />
              {formData.logo && (
                <img src={formData.logo} alt="Logo preview" className="mt-2 w-20 sm:w-24 h-20 sm:h-24 rounded-lg object-cover border" />
              )}
            </div>
            <div>
              <label htmlFor="company-cover" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
                Cover Image
              </label>
              <input
                id="company-cover"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'cover')}
                className="w-full text-xs sm:text-sm"
                disabled={loading || uploading}
              />
              {formData.cover && (
                <img src={formData.cover} alt="Cover preview" className="mt-2 w-full h-20 sm:h-24 rounded-lg object-cover border" />
              )}
            </div>
          </div>

          <div>
            <label htmlFor="company-about" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-1">
              About Company
            </label>
            <textarea
              id="company-about"
              name="about"
              value={formData.about}
              onChange={handleInputChange}
              placeholder="Tell us about your company..."
              rows="3"
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 resize-none"
              disabled={loading}
            />
          </div>

          {/* Commercial Registry Image Upload */}
          <div>
            <label htmlFor="company-commercial-registry-image" className="block text-xs sm:text-sm font-semibold text-gray-900 mb-2">
              Commercial Registry Image *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              {formData.commercial_registry_image ? (
                <div className="space-y-2">
                  <img
                    src={formData.commercial_registry_image}
                    alt="Commercial Registry"
                    className="max-h-40 mx-auto rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, commercial_registry_image: '' }))}
                    className="text-xs sm:text-sm text-red-600 hover:text-red-700"
                    disabled={loading}
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-4 sm:w-5 h-4 sm:h-5 text-gray-400" />
                    <span className="text-xs sm:text-sm text-gray-600">Click to upload commercial registry image</span>
                  </div>
                  <input
                    id="company-commercial-registry-image"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'commercial_registry_image')}
                    className="hidden"
                    disabled={uploading || loading}
                  />
                </label>
              )}
              {uploading && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                  <span className="text-xs sm:text-sm text-gray-500">Uploading...</span>
                </div>
              )}
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
              disabled={loading || uploading}
              className="flex-1 px-2 sm:px-4 py-1.5 sm:py-2 bg-[#0a66c2] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#004182] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 sm:w-4 h-3 sm:h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Your company request will be reviewed by our admin team. You'll be notified once it's approved or rejected.
          </p>
        </form>
      </div>
    </div>
  );
}
