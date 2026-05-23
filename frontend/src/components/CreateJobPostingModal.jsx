import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { jobsApi, companiesApi } from '../api';
import { toast } from 'sonner';

export default function CreateJobPostingModal({ isOpen, onClose, onSuccess, initialCompany }) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [showCompanySearch, setShowCompanySearch] = useState(false);
  const [companySearch, setCompanySearch] = useState('');

  const [formData, setFormData] = useState({
    company_id: '',
    title: '',
    requirements: '',
    details: '',
    salary: '',
    salary_currency: 'USD',
    location: '',
    job_type: 'Full-time',
  });

  useEffect(() => {
    if (isOpen && initialCompany) {
      setFormData((prev) => ({ ...prev, company_id: initialCompany.id }));
      setCompanySearch(initialCompany.name || '');
      setShowCompanySearch(false);
    }
    if (!isOpen) {
      setFormData({
        company_id: '',
        title: '',
        requirements: '',
        details: '',
        salary: '',
        salary_currency: 'USD',
        location: '',
        job_type: 'Full-time',
      });
      setCompanySearch('');
      setCompanies([]);
    }
  }, [isOpen, initialCompany]);

  const handleCompanySearch = async (e) => {
    const query = e.target.value;
    setCompanySearch(query);
    
    if (query.length < 2) {
      setCompanies([]);
      return;
    }

    setCompaniesLoading(true);
    try {
      const data = await companiesApi.list(query);
      setCompanies(data || []);
    } catch (error) {
      toast.error('Failed to search companies');
      setCompanies([]);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const handleCompanySelect = (company) => {
    setFormData(prev => ({
      ...prev,
      company_id: company.id,
    }));
    setCompanySearch(company.name);
    setShowCompanySearch(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'salary' ? parseFloat(value) || '' : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.company_id.trim()) {
      toast.error('Please select a company');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Job title is required');
      return;
    }
    if (!formData.requirements.trim()) {
      toast.error('Requirements are required');
      return;
    }
    if (!formData.details.trim()) {
      toast.error('Job details are required');
      return;
    }

    setLoading(true);
    try {
      await jobsApi.createPosting(formData);
      toast.success('Job posting created successfully!');
      setFormData({
        company_id: '',
        title: '',
        requirements: '',
        details: '',
        salary: '',
        salary_currency: 'USD',
        location: '',
        job_type: 'Full-time',
      });
      setCompanySearch('');
      onClose();
      onSuccess?.();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create job posting');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 flex items-center justify-between">
          <h2 className="text-xl font-bold">Post a Job</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {/* Company Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Select Company *
            </label>
            <div className="relative">
              <input
                type="text"
                value={companySearch}
                onChange={handleCompanySearch}
                onFocus={() => setShowCompanySearch(true)}
                placeholder="Search and select a company"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                disabled={loading}
                autoComplete="off"
              />
              {showCompanySearch && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {companiesLoading ? (
                    <div className="p-3 text-center text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                      Loading...
                    </div>
                  ) : companies.length === 0 ? (
                    <div className="p-3 text-center text-sm text-gray-500">No companies found</div>
                  ) : (
                    companies.map(company => (
                      <button
                        key={company.id}
                        type="button"
                        onClick={() => handleCompanySelect(company)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                      >
                        {company.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Job Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Senior Frontend Engineer"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Job Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Job Type
            </label>
            <select
              name="job_type"
              value={formData.job_type}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
              <option value="Temporary">Temporary</option>
            </select>
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Requirements *
            </label>
            <textarea
              name="requirements"
              value={formData.requirements}
              onChange={handleInputChange}
              placeholder="e.g., 3+ years experience, React, TypeScript"
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 resize-none"
              disabled={loading}
            />
          </div>

          {/* Details */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Job Details *
            </label>
            <textarea
              name="details"
              value={formData.details}
              onChange={handleInputChange}
              placeholder="Describe the job, responsibilities, and what you're looking for..."
              rows="4"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50 resize-none"
              disabled={loading}
            />
          </div>

          {/* Salary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Salary
              </label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleInputChange}
                placeholder="e.g., 50000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                disabled={loading}
                min="0"
                step="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Currency
              </label>
              <select
                name="salary_currency"
                value={formData.salary_currency}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
                disabled={loading}
              >
                <option value="USD">USD ($)</option>
                <option value="LBP">LBP (ل.ل)</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="e.g., Damascus, Syria or Remote"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0a66c2]/50"
              disabled={loading}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#0a66c2] text-white rounded-lg text-sm font-semibold hover:bg-[#004182] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                'Publish Job'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
