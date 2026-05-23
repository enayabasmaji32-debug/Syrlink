import React, { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { companyRequestsApi } from '../api';
import { Briefcase, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function MyCompanyRequests() {
  const { user, authReady } = useApp();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authReady && user) {
      companyRequestsApi.myRequests()
        .then(setRequests)
        .catch(() => {
          toast.error('فشل تحميل الطلبات');
          setRequests([]);
        })
        .finally(() => setLoading(false));
    }
  }, [authReady, user]);

  if (!authReady) return null;
  if (!user) return <Navigate to="/login" replace />;

  if (loading) return <div className="text-center py-10">جاري التحميل...</div>;

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return { bg: 'bg-yellow-50', text: 'text-yellow-700', icon: Clock, label: 'معلق' };
      case 'approved':
        return { bg: 'bg-green-50', text: 'text-green-700', icon: CheckCircle2, label: '✓ موافق عليه' };
      case 'rejected':
        return { bg: 'bg-red-50', text: 'text-red-700', icon: XCircle, label: 'مرفوض' };
      default:
        return { bg: 'bg-gray-50', text: 'text-gray-700', icon: AlertCircle, label: status };
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">طلبات شركاتي</h1>
        <p className="text-gray-600">متابعة حالة طلبات تسجيل الشركات</p>
      </div>

      {requests.length === 0 ? (
        <div className="li-card p-8 text-center">
          <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h2 className="font-semibold text-gray-700 mb-1">لا توجد طلبات</h2>
          <p className="text-gray-600 text-sm mb-4">لم تقدم أي طلب لتسجيل شركة حتى الآن</p>
          <Link
            to="/companies"
            className="inline-block bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold text-sm rounded-full px-4 py-2"
          >
            تسجيل شركة
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const statusInfo = getStatusColor(req.status);
            const StatusIcon = statusInfo.icon;
            return (
              <div key={req.id} className={`li-card p-4 ${statusInfo.bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${statusInfo.text}`}>
                    <Briefcase className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">{req.name}</h3>
                      <StatusIcon className={`w-5 h-5 ${statusInfo.text}`} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-700 mb-2">
                      <p><b>القطاع:</b> {req.industry}</p>
                      <p><b>الموقع:</b> {req.location || 'غير محدد'}</p>
                      <p><b>عدد الموظفين:</b> {req.employees_count}</p>
                      <p><b>الحالة:</b> <span className={`font-semibold ${statusInfo.text}`}>{statusInfo.label}</span></p>
                    </div>

                    <div className="text-xs text-gray-600">
                      <p>تاريخ التقديم: {new Date(req.created_at).toLocaleDateString('ar-EG')}</p>
                      {req.reviewed_at && (
                        <p>تاريخ المراجعة: {new Date(req.reviewed_at).toLocaleDateString('ar-EG')}</p>
                      )}
                    </div>

                    {req.decision_reason && (
                      <div className={`mt-3 p-3 rounded-lg ${statusInfo.bg} border-l-4 ${statusInfo.text}`}>
                        <p className="text-xs font-semibold mb-1">ملاحظات المسؤول:</p>
                        <p className="text-sm">{req.decision_reason}</p>
                      </div>
                    )}
                  </div>
                </div>

                {req.status === 'rejected' && (
                  <div className="mt-3 flex gap-2">
                    <Link
                      to="/companies"
                      className="text-sm px-3 py-1.5 bg-[#0a66c2] text-white rounded-full hover:bg-[#004182] font-semibold"
                    >
                      تقديم طلب جديد
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
