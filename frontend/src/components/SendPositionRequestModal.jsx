import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { companiesApi, usersApi } from '../api';

export default function SendPositionRequestModal({ isOpen, onClose, company, onSuccess }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search for employees
  useEffect(() => {
    if (!searchQuery.trim()) {
      setEmployees([]);
      return;
    }

    setSearching(true);
    usersApi
      .search(searchQuery)
      .then((results) => {
        // Filter out employees already in the company
        const filtered = results.filter(
          (emp) => !company.employees?.some((e) => e.id === emp.id)
        );
        setEmployees(filtered);
      })
      .catch(() => setEmployees([]))
      .finally(() => setSearching(false));
  }, [searchQuery, company.employees]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee || !position.trim()) {
      setError('Please select an employee and enter a position');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await companiesApi.sendPositionRequest(company.id, {
        employee_id: selectedEmployee.id,
        position: position.trim(),
        department: department.trim(),
        description: description.trim(),
      });

      setSuccess('Position request sent successfully!');
      setTimeout(() => {
        setPosition('');
        setDepartment('');
        setDescription('');
        setSelectedEmployee(null);
        setSearchQuery('');
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send position request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Send Position Request</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Employee Search */}
          <div>
            <label className="block text-sm font-semibold mb-2">Search Employee</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
                disabled={loading}
              />
              {searching && (
                <div className="absolute right-3 top-2">
                  <Loader className="w-5 h-5 animate-spin text-[#0a66c2]" />
                </div>
              )}
            </div>

            {/* Search Results */}
            {employees.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {employees.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(emp);
                      setSearchQuery('');
                      setEmployees([]);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={emp.avatar || 'https://via.placeholder.com/40'}
                        alt={emp.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{emp.name}</p>
                        <p className="text-xs text-gray-600 truncate">{emp.headline}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && employees.length === 0 && !searching && (
              <p className="mt-2 text-sm text-gray-500">No employees found</p>
            )}
          </div>

          {/* Selected Employee */}
          {selectedEmployee && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedEmployee.avatar || 'https://via.placeholder.com/40'}
                    alt={selectedEmployee.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-sm">{selectedEmployee.name}</p>
                    <p className="text-xs text-gray-600">{selectedEmployee.headline}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Position */}
          <div>
            <label className="block text-sm font-semibold mb-2">Position *</label>
            <input
              type="text"
              placeholder="e.g., Software Engineer, HR Manager"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
              disabled={loading}
              required
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-semibold mb-2">Department (Optional)</label>
            <input
              type="text"
                placeholder="e.g., Engineering, HR, Sales"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a66c2]"
              disabled={loading}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold mb-2">Description (Optional)</label>
            <textarea
              placeholder="Brief description of the position and responsibilities..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0a66c2] resize-none"
              disabled={loading}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">
              {success}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedEmployee || !position.trim()}
              className="flex-1 px-4 py-2 bg-[#0a66c2] text-white font-semibold rounded-lg hover:bg-[#004182] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
