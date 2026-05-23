import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { reportsApi } from '../api';
import { toast } from 'sonner';

const REPORT_REASONS = [
  { value: 'abusive_content', label: 'محتوى مسيء' },
  { value: 'harassment', label: 'تنمّر أو مضايقة' },
  { value: 'hate_speech', label: 'خطاب كراهية' },
  { value: 'violence_threat', label: 'عنف أو تهديد' },
  { value: 'sexual_content', label: 'محتوى جنسي غير لائق' },
  { value: 'fraud_suspicious_links', label: 'احتيال أو روابط مشبوهة' },
  { value: 'impersonation', label: 'انتحال شخصية' },
  { value: 'spam', label: 'سبام أو إزعاج' },
  { value: 'misinformation', label: 'معلومات مضللة' },
  { value: 'illegal_content', label: 'محتوى غير قانوني' },
  { value: 'fake_company', label: 'شركة وهمية' },
  { value: 'fake_job', label: 'وظيفة وهمية' },
  { value: 'job_exploitation', label: 'استغلال وظيفي' },
  { value: 'misleading_company_info', label: 'معلومات شركة مضللة' },
];

export default function ReportModal({ isOpen, onClose, targetType, targetId, targetName = '' }) {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReason) {
      toast.error('الرجاء اختيار سبب الإبلاغ');
      return;
    }

    setLoading(true);
    try {
      await reportsApi.submit(targetType, targetId, selectedReason, details);
      toast.success('✓ شكراً لإبلاغك. سيتم مراجعة الأمر من قبل فريقنا');
      onClose();
      setSelectedReason('');
      setDetails('');
    } catch (e) {
      toast.error('فشل إرسال الإبلاغ');
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <h2 className="font-semibold text-lg">إبلاغ</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          {targetName && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">الإبلاغ عن:</p>
              <p className="font-semibold text-sm truncate">{targetName}</p>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-semibold mb-2 text-gray-800">سبب الإبلاغ *</label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {REPORT_REASONS.map((reason) => (
                <label key={reason.value} className="flex items-center gap-3 p-2 cursor-pointer hover:bg-gray-50 rounded transition">
                  <input
                    type="radio"
                    name="reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm text-gray-700">{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="details" className="block text-sm font-semibold mb-2 text-gray-800">
              تفاصيل إضافية (اختياري)
            </label>
            <textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="أخبرنا بمزيد من التفاصيل..."
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{details.length}/500</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || !selectedReason}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال الإبلاغ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
