import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, Loader2, Search, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { companiesApi, uploadApi, usersApi } from '../api';
import { toast } from 'sonner';

export default function EditCompany() {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user, setActiveCompany } = useApp();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState({
    name: '',
    tagline: '',
    about: '',
    website: '',
    location: '',
    industry: '',
    employees_count: 0,
    logo: '',
    cover: '',
    is_looking_for_investors: false,
    valuation: '',
    investment_type: '',
    funding_amount: '',
    company_status: '',
    available_equity: '',
    funding_round_status: '',
  });
  const [employees, setEmployees] = useState([]);
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newEmployeeRole, setNewEmployeeRole] = useState('Software Engineer');
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    companiesApi.get(companyId)
      .then((data) => {
        setCompany(data);
        setEmployees(data.employees || []);
        setForm({
          name: data.name || '',
          tagline: data.tagline || '',
          about: data.about || '',
          website: data.website || '',
          location: data.location || '',
          industry: data.industry || '',
          employees_count: data.employees_count || 0,
          logo: data.logo || '',
          cover: data.cover || '',
          is_looking_for_investors: data.is_looking_for_investors || false,
          valuation: data.valuation || '',
          investment_type: data.investment_type || '',
          funding_amount: data.funding_amount || '',
          company_status: data.company_status || '',
          available_equity: data.available_equity || '',
          funding_round_status: data.funding_round_status || '',
        });
      })
      .catch(() => {
        setCompany(null);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  const handleUpload = async (file, type) => {
    if (!file) return;
    const setUploading = type === 'logo' ? setUploadingLogo : setUploadingCover;
    const key = type === 'logo' ? 'logo' : 'cover';
    setUploading(true);
    try {
      const res = await uploadApi.uploadFile(file, `companies/${companyId}`);
      setForm((prev) => ({ ...prev, [key]: res.secure_url }));
      toast.success(`${type === 'logo' ? 'Logo' : 'Cover'} uploaded successfully`);
    } catch (e) {
      console.error('Upload failed', e);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const searchUsers = async () => {
    if (!employeeQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setEmployeeLoading(true);
    try {
      const results = await usersApi.search(employeeQuery.trim());
      setSearchResults(results || []);
    } catch (e) {
      console.error('User search failed', e);
      toast.error('Search failed. حاول باسم مستخدم أو بريد إلكتروني صحيح');
    } finally {
      setEmployeeLoading(false);
    }
  };

  const addEmployee = async () => {
    if (!selectedUser) {
      toast.error('Please select a user first');
      return;
    }
    if (!newEmployeeRole.trim()) {
      toast.error('Please add a job title');
      return;
    }
    setEmployeeLoading(true);
    try {
      const updated = await companiesApi.addEmployee(companyId, {
        user_id: selectedUser.id,
        role: newEmployeeRole.trim(),
      });
      setCompany(updated);
      setEmployees(updated.employees || []);
      setForm((prev) => ({ ...prev, employees_count: updated.employees_count || updated.employees?.length || 0 }));
      setSelectedUser(null);
      setSearchResults([]);
      setEmployeeQuery('');
      toast.success('Employee added successfully');
    } catch (e) {
      console.error('Add employee failed', e);
      toast.error(e?.response?.data?.detail || 'Could not add employee');
    } finally {
      setEmployeeLoading(false);
    }
  };

  const removeEmployee = async (employeeId) => {
    setEmployeeLoading(true);
    try {
      const updated = await companiesApi.removeEmployee(companyId, employeeId);
      setCompany(updated);
      setEmployees(updated.employees || []);
      setForm((prev) => ({ ...prev, employees_count: updated.employees_count || updated.employees?.length || 0 }));
      toast.success('Employee removed successfully');
    } catch (e) {
      console.error('Remove employee failed', e);
      toast.error(e?.response?.data?.detail || 'Could not remove employee');
    } finally {
      setEmployeeLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Company name is required');
      return;
    }
    if (!company) return;
    setSaving(true);
    try {
      const updated = await companiesApi.update(companyId, {
        name: form.name,
        tagline: form.tagline,
        about: form.about,
        website: form.website,
        location: form.location,
        industry: form.industry,
        employees_count: employees.length,
        logo: form.logo,
        cover: form.cover,
        employees,
        is_looking_for_investors: form.is_looking_for_investors,
        valuation: form.valuation ? Number(form.valuation) : null,
        investment_type: form.investment_type,
        funding_amount: form.funding_amount ? Number(form.funding_amount) : null,
        company_status: form.company_status,
        available_equity: form.available_equity ? Number(form.available_equity) : null,
        funding_round_status: form.funding_round_status,
      });
      toast.success('Company profile updated successfully');
      setCompany(updated);
      if (user?.id === company.user_id) {
        setActiveCompany(updated.id);
      }
      navigate(`/company/${companyId}`);
    } catch (e) {
      console.error('Update failed', e);
      toast.error(e?.response?.data?.detail || 'Could not update company');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading company…</div>;
  }

  if (!company) {
    return <div className="text-center py-10">Company not found or you are not authorized.</div>;
  }

  if (!user || (!user.is_admin && user.id !== company.user_id)) {
    return <div className="text-center py-10">You are not allowed to edit this company.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="li-card p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Edit {company.name}</h1>
            <p className="text-sm text-gray-600">Update company details, logo and cover image.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="block text-sm font-semibold">Company Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">Tagline</label>
            <input
              value={form.tagline}
              onChange={(e) => setForm((prev) => ({ ...prev, tagline: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-4 lg:col-span-2">
            <label className="block text-sm font-semibold">About</label>
            <textarea
              value={form.about}
              onChange={(e) => setForm((prev) => ({ ...prev, about: e.target.value }))}
              rows={5}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">Website</label>
            <input
              value={form.website}
              onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">Industry</label>
            <input
              value={form.industry}
              onChange={(e) => setForm((prev) => ({ ...prev, industry: e.target.value }))}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">Employees Count</label>
            <input
              type="number"
              value={employees.length}
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="li-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Image className="w-4 h-4" /> Logo
            </div>
            <img src={form.logo || company.logo} alt="Company logo" className="w-full h-40 object-cover rounded border" />
            <label className="inline-flex items-center gap-2 text-sm text-[#0a66c2] cursor-pointer hover:underline">
              {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload logo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0], 'logo')}
              />
            </label>
          </div>

          <div className="li-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Image className="w-4 h-4" /> Cover image
            </div>
            <div className="h-40 w-full bg-gray-100 rounded border overflow-hidden">
              <img src={form.cover || company.cover} alt="Cover" className="w-full h-full object-cover" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-[#0a66c2] cursor-pointer hover:underline">
              {uploadingCover ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload cover'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files?.[0], 'cover')}
              />
            </label>
          </div>
        </div>

        {/* Investment Section */}
        <div className="li-card p-4 space-y-4 border-l-4 border-amber-400">
          <div>
            <h2 className="text-lg font-semibold">Investment Information</h2>
            <p className="text-sm text-gray-600">Update your company's investment needs and details.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={form.is_looking_for_investors}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_looking_for_investors: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold">Are you looking for investors?</span>
              </label>
            </div>

            {form.is_looking_for_investors && (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Estimated Valuation ($)</label>
                  <input
                    type="number"
                    value={form.valuation}
                    onChange={(e) => setForm((prev) => ({ ...prev, valuation: e.target.value }))}
                    placeholder="e.g., 1000000"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Type of Investment Needed</label>
                  <input
                    type="text"
                    value={form.investment_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, investment_type: e.target.value }))}
                    placeholder="e.g., Equity, Debt, Convertible Note"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Requested Funding Amount ($)</label>
                  <input
                    type="number"
                    value={form.funding_amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, funding_amount: e.target.value }))}
                    placeholder="e.g., 50000"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Current Company Status</label>
                  <input
                    type="text"
                    value={form.company_status}
                    onChange={(e) => setForm((prev) => ({ ...prev, company_status: e.target.value }))}
                    placeholder="e.g., Growth stage, Expansion"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Available Equity for Investment (%)</label>
                  <input
                    type="number"
                    value={form.available_equity}
                    onChange={(e) => setForm((prev) => ({ ...prev, available_equity: e.target.value }))}
                    placeholder="e.g., 10"
                    min="0"
                    max="100"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold">Funding Round Status</label>
                  <input
                    type="text"
                    value={form.funding_round_status}
                    onChange={(e) => setForm((prev) => ({ ...prev, funding_round_status: e.target.value }))}
                    placeholder="e.g., Seed, Series A"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Employees Section */}
        <div className="li-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Employees</h2>
              <p className="text-sm text-gray-600">Add or remove employees and assign their company role.</p>
            </div>
            <span className="text-sm text-gray-500">{employees.length} employee{employees.length === 1 ? '' : 's'}</span>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <label className="block text-sm font-semibold">Search user</label>
              <div className="flex gap-2">
                <input
                  value={employeeQuery}
                  onChange={(e) => setEmployeeQuery(e.target.value)}
                  className="flex-1 border rounded px-3 py-2"
                  placeholder="Name or email"
                />
                <button
                  type="button"
                  onClick={searchUsers}
                  disabled={employeeLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a66c2] text-white px-4 py-2 text-sm hover:bg-[#004182] disabled:opacity-70"
                >
                  <Search className="w-4 h-4" /> Search
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-semibold">Role</label>
              <input
                value={newEmployeeRole}
                onChange={(e) => setNewEmployeeRole(e.target.value)}
                className="w-full border rounded px-3 py-2"
                placeholder="مثال: مهندس برمجيات"
              />
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Select a user to add:</p>
              <div className="space-y-2">
                {searchResults.map((userItem) => (
                  <button
                    key={userItem.id}
                    type="button"
                    onClick={() => setSelectedUser(userItem)}
                    className={`w-full text-left rounded-xl border px-3 py-3 transition ${selectedUser?.id === userItem.id ? 'border-[#0a66c2] bg-[#eff6ff]' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <img src={userItem.avatar || '/default-avatar.png'} alt={userItem.name} className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="font-semibold">{userItem.name}</p>
                        <p className="text-xs text-gray-500">{userItem.email || userItem.headline || 'No extra info'}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedUser && (
            <div className="rounded-xl border border-[#0a66c2] bg-[#eff6ff] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-600">Selected employee</p>
                  <p className="font-semibold">{selectedUser.name}</p>
                  <p className="text-xs text-gray-500">{selectedUser.email || selectedUser.headline}</p>
                </div>
                <button
                  type="button"
                  onClick={addEmployee}
                  disabled={employeeLoading}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0a66c2] text-white px-4 py-2 text-sm hover:bg-[#004182] disabled:opacity-70"
                >
                  Add to company
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {employees?.length > 0 ? (
              employees.map((emp) => (
                <div key={emp.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <img src={emp.avatar || '/default-avatar.png'} alt={emp.name} className="w-12 h-12 rounded-full object-cover" />
                    <div>
                      <p className="font-semibold">{emp.name}</p>
                      <p className="text-sm text-gray-600">{emp.role}</p>
                      {emp.headline && <p className="text-xs text-gray-500">{emp.headline}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEmployee(emp.id)}
                    disabled={employeeLoading}
                    className="inline-flex items-center gap-2 rounded-full border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-70"
                  >
                    <Trash2 className="w-4 h-4" /> Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No employees assigned yet.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(`/company/${company.id}`)}
            className="border border-gray-300 rounded-full px-5 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#0a66c2] text-white rounded-full px-5 py-2 text-sm font-semibold hover:bg-[#004182] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
