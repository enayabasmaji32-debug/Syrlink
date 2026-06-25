import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Search, Building2, MapPin, DollarSign, Loader2 } from 'lucide-react';
import { companiesApi } from '../api';

export default function InvestmentOpportunities() {
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 12;
  const loadMoreRef = useRef(null);

  const loadCompanies = useCallback(async (resetPagination = true) => {
    const pageSkip = resetPagination ? 0 : skip;
    if (resetPagination) setLoading(true); else setLoadingMore(true);

    try {
      const response = await companiesApi.list(query, pageSkip, LIMIT, true);
      let items = response.data || response || [];
      setCompanies((prev) => resetPagination ? items : [...prev, ...items]);
      setTotal(response.total || items.length);
      setHasMore(pageSkip + LIMIT < (response.total || 0));
      setSkip(resetPagination ? LIMIT : pageSkip + LIMIT);
    } catch (err) {
      console.error('Failed to load investment opportunities:', err);
      if (resetPagination) setCompanies([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, skip]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        loadCompanies(false);
      }
    }, { threshold: 0.1 });

    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadCompanies]);

  useEffect(() => {
    setSkip(0);
    loadCompanies(true);
  }, [query]);

  const handleSearch = (event) => {
    event.preventDefault();
    setSkip(0);
    loadCompanies(true);
  };

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
      <section className="li-card p-4 mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">فرص الاستثمار</h1>
            <p className="text-sm text-gray-600 mt-1">اكتشف الشركات الناشئة التي تبحث عن مستثمرين.</p>
          </div>
          <form onSubmit={handleSearch} className="w-full sm:w-auto flex gap-2 items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث عن شركة أو صناعة"
                className="w-full h-11 rounded-full bg-[#edf3f8] pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-full bg-[#0a66c2] px-5 text-sm font-semibold text-white hover:bg-[#004182]"
            >
              بحث
            </button>
          </form>
        </div>
      </section>

      <section className="li-card p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">شركات تبحث عن استثمار</h2>
            {loading ? (
              <p className="text-xs text-gray-500 mt-1">جارٍ التحميل…</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">{companies.length} نتيجة</p>
            )}
          </div>
        </div>

        {companies.length === 0 && !loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            لا توجد فرص استثمارية متاحة حالياً.
          </div>
        ) : (
          <div className="space-y-3">
            {companies.map((company) => (
              <div key={company.id} className="border border-gray-100 rounded-2xl p-4 hover:shadow-sm transition">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <img
                    src={company.logo}
                    alt={company.name}
                    crossOrigin="anonymous"
                    onError={(ev) => { ev.target.style.display = 'none'; }}
                    className="w-20 h-20 rounded-xl object-contain bg-gray-50 border border-gray-100"
                  />
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[#0a66c2] truncate">{company.name}</h3>
                        <div className="mt-2">
                          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                            <DollarSign className="w-3.5 h-3.5" />
                            Seeking investors
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{company.tagline || 'No tagline available.'}</p>
                      </div>
                      <Link
                        to={`/company/${company.id}`}
                        className="self-start rounded-full border border-[#0a66c2] px-4 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#0a66c2]/10"
                      >
                        عرض التفاصيل
                      </Link>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3 text-xs text-gray-600">
                      {company.industry && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {company.industry}
                        </div>
                      )}
                      {company.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {company.location}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        {company.employees_count ?? 0} موظف
                      </div>
                    </div>

                    <div className="mt-3 text-sm text-gray-700">
                      <h4 className="text-sm font-semibold mb-1">تفاصيل الاستثمار</h4>
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        {company.valuation != null && (
                          <div>التقييم: <span className="text-gray-600">{company.valuation}</span></div>
                        )}
                        {company.investment_type && (
                          <div>نوع الاستثمار: <span className="text-gray-600">{company.investment_type}</span></div>
                        )}
                        {company.funding_amount != null && (
                          <div>مبلغ التمويل: <span className="text-gray-600">{company.funding_amount}</span></div>
                        )}
                        {company.available_equity != null && (
                          <div>الأسهم المتاحة: <span className="text-gray-600">{company.available_equity}%</span></div>
                        )}
                        {company.funding_round_status && (
                          <div>حولة التمويل: <span className="text-gray-600">{company.funding_round_status}</span></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={loadMoreRef} className="py-8 text-center">
              {loadingMore && (
                <div className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-500">جارٍ تحميل المزيد…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
