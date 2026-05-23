import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, MapPin } from 'lucide-react';
import { companiesApi } from '../api';

export default function EmployeePositionRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await companiesApi.getReceivedRequests(filter);
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to fetch position requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId) => {
    setProcessingId(requestId);
    try {
      await companiesApi.acceptPositionRequest(requestId);
      setRequests(requests.map((r) => (r.id === requestId ? { ...r, status: 'accepted' } : r)));
    } catch (err) {
      console.error('Failed to accept request:', err);
      alert(err.response?.data?.detail || 'Failed to accept request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await companiesApi.rejectPositionRequest(requestId);
      setRequests(requests.map((r) => (r.id === requestId ? { ...r, status: 'rejected' } : r)));
    } catch (err) {
      console.error('Failed to reject request:', err);
      alert(err.response?.data?.detail || 'Failed to reject request');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'accepted':
        return 'bg-green-50 border-green-200';
      case 'rejected':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'accepted':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
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
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="li-card p-6">
        <h1 className="text-2xl font-bold mb-2">Position Requests</h1>
        <p className="text-gray-600">
          Manage position invitations from companies on the platform.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="li-card p-4 border-b border-gray-200">
        <div className="flex gap-2">
          {['pending', 'accepted', 'rejected', 'all'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-2 text-sm font-medium transition capitalize rounded-full ${
                filter === tab
                  ? 'bg-[#0a66c2] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="li-card p-6 text-center text-gray-500">
          Loading position requests...
        </div>
      ) : requests.length === 0 ? (
        <div className="li-card p-6 text-center text-gray-500">
          <p>
            {filter === 'pending'
              ? 'No pending position requests at the moment.'
              : `No ${filter} position requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`li-card border-l-4 ${
                req.status === 'pending'
                  ? 'border-l-yellow-400'
                  : req.status === 'accepted'
                  ? 'border-l-green-400'
                  : 'border-l-red-400'
              }`}
            >
              <div className={`p-6 ${getStatusColor(req.status)}`}>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Company Logo */}
                    <img
                      src={req.company?.avatar || 'https://via.placeholder.com/50'}
                      alt={req.company?.name}
                      className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    />

                    {/* Request Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold">{req.company?.name}</h3>
                        {getStatusIcon(req.status)}
                      </div>

                      <p className="text-2xl font-semibold text-[#0a66c2] mb-2">{req.position}</p>

                      {req.department && (
                        <div className="flex items-center gap-1 mb-2 text-gray-700">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">{req.department}</span>
                        </div>
                      )}

                      {req.description && (
                        <p className="text-sm text-gray-700 mb-2">{req.description}</p>
                      )}

                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>Sent: {formatDate(req.created_at)}</span>
                        {req.responded_at && (
                          <span>
                            {req.status === 'accepted' ? 'Accepted' : 'Rejected'}:{' '}
                            {formatDate(req.responded_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                        req.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : req.status === 'accepted'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                {req.status === 'pending' && (
                  <div className="flex gap-3 mt-4 pt-4 border-t border-current border-opacity-20">
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={processingId === req.id}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processingId === req.id ? 'Processing...' : 'Decline'}
                    </button>
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={processingId === req.id}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processingId === req.id ? 'Processing...' : 'Accept'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
