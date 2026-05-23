import React, { useState, useEffect } from 'react';
import { Plus, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { companiesApi } from '../api';
import SendPositionRequestModal from './SendPositionRequestModal';

export default function PositionRequestsList({ company }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!company?.id) {
      setLoading(false);
      return;
    }

    fetchRequests();
  }, [company?.id, filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await companiesApi.getSentRequests(company.id, filter);
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to fetch position requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'accepted':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'rejected':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'accepted':
        return <CheckCircle className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <section className="li-card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Position Requests</h2>
            <p className="text-sm text-gray-600">Manage position assignments for employees.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#0a66c2] text-white px-3 py-2 rounded-full text-sm font-semibold hover:bg-[#004182] transition"
          >
            <Plus className="w-4 h-4" /> Send Request
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          {['pending', 'accepted', 'rejected', 'all'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition capitalize border-b-2 ${
                filter === tab
                  ? 'border-[#0a66c2] text-[#0a66c2]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <p className="text-sm text-gray-500">Loading position requests...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">
            {filter === 'pending' ? 'No pending requests.' : `No ${filter} requests.`}
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className={`border rounded-lg p-4 ${getStatusColor(req.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <img
                      src={req.employee?.avatar || 'https://via.placeholder.com/40'}
                      alt={req.employee?.name}
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{req.employee?.name}</p>
                        {getStatusIcon(req.status)}
                      </div>
                      <p className="text-sm font-medium">{req.position}</p>
                      {req.department && (
                        <p className="text-xs opacity-80">{req.department}</p>
                      )}
                      {req.description && (
                        <p className="text-xs mt-1 opacity-80">{req.description}</p>
                      )}
                      <p className="text-xs opacity-70 mt-2">
                        Sent: {formatDate(req.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                        req.status === 'pending'
                          ? 'bg-yellow-100'
                          : req.status === 'accepted'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}
                    >
                      {req.status}
                    </span>
                    {req.responded_at && (
                      <p className="text-xs opacity-70 mt-2">
                        {req.status === 'accepted' ? 'Accepted' : 'Rejected'}:{' '}
                        {formatDate(req.responded_at)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      <SendPositionRequestModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        company={company}
        onSuccess={fetchRequests}
      />
    </>
  );
}
