import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Building2, Globe, MapPin, Plus, DollarSign } from 'lucide-react';
import { companiesApi } from '../api';
import CreateCompanyModal from '../components/CreateCompanyModal';

export default function Companies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [companies, setCompanies] = useState([]);
  const [showInvestorsOnly, setShowInvestorsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 20;

  const loadCompanies = async (resetPagination = true) => {
    const q = searchParams.get('q') || '';
    setQuery(q);
    const pageSkip = resetPagination ? 0 : skip;
    
    setLoading(true);
    try {
      const response = await companiesApi.list(q, pageSkip, LIMIT);
      let items = response.data || response || [];
      
      if (showInvestorsOnly) {
        items = items.filter((c) => c.is_looking_for_investors === true);
      }
      
      setCompanies(resetPagination ? items : [...companies, ...items]);
      setTotal(response.total || items.length);
      setSkip(pageSkip + LIMIT);
      setHasMore(pageSkip + LIMIT < (response.total || 0));
    } catch (err) {
      console.error('Failed to load companies:', err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSkip(0);
    loadCompanies(true);
  }, [searchParams, showInvestorsOnly]);

  const handleSearch = (event) => {
    event.preventDefault();
    const trimmed = query.trim();
    setSearchParams(trimmed ? { q: trimmed } : {});
  };

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4">
      <section className="li-card p-4 mb-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Company search</h1>
            <p className="text-sm text-gray-600 mt-1">Find companies, explore profiles, and view company details.</p>
          </div>
          <form onSubmit={handleSearch} className="w-full sm:w-auto flex gap-2 items-center">
            <div className="relative w-full sm:w-[320px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search companies, industries, or locations"
                className="w-full h-11 rounded-full bg-[#edf3f8] pl-10 pr-4 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0a66c2]/30"
              />
            </div>
            <button
              type="submit"
              className="h-11 rounded-full bg-[#0a66c2] px-5 text-sm font-semibold text-white hover:bg-[#004182]"
            >
              Search
            </button>
            <label className="flex items-center gap-1 ml-4 text-sm select-none">
              <input
                type="checkbox"
                checked={showInvestorsOnly}
                onChange={e => setShowInvestorsOnly(e.target.checked)}
                className="accent-[#0a66c2]"
              />
              فرص استثمارية
            </label>
          </form>
        </div>
      </section>

      <section className="li-card p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">Companies</h2>
            {(() => {
              if (loading) return <p className="text-xs text-gray-500 mt-1">Loading companies…</p>;
              const label = companies.length === 1 ? 'result' : 'results';
              return <p className="text-xs text-gray-500 mt-1">{`${companies.length} ${label}`}</p>;
            })()}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 bg-[#0a66c2] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#004182]"
            >
              <Plus className="w-4 h-4" />
              Create Company
            </button>
            {query && (
              <Link to="/companies" className="text-sm text-[#0a66c2] hover:underline">
                Clear search
              </Link>
            )}
          </div>
        </div>

        {companies.length === 0 && !loading ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No companies found. Try a different keyword.
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
                        {company.is_looking_for_investors && (
                          <div className="mt-2">
                            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                              <DollarSign className="w-3.5 h-3.5" />
                              Seeking investors
                            </span>
                          </div>
                        )}
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{company.tagline || 'No tagline available.'}</p>
                      </div>
                      <Link
                        to={`/company/${company.id}`}
                        className="self-start rounded-full border border-[#0a66c2] px-4 py-2 text-sm font-semibold text-[#0a66c2] hover:bg-[#0a66c2]/10"
                      >
                        View profile
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
                        <Globe className="w-3.5 h-3.5" />
                        {company.employees_count ?? 0} employees
                      </div>
                    </div>
                    {showInvestorsOnly && company.is_looking_for_investors && (
                      <div className="mt-3 text-sm text-gray-700">
                        <h4 className="text-sm font-semibold mb-1">Investment details</h4>
                        <div className="grid gap-2 sm:grid-cols-2 text-sm">
                          {company.valuation != null && (
                            <div>Valuation: <span className="text-gray-600">{company.valuation}</span></div>
                          )}
                          {company.investment_type && (
                            <div>Investment type: <span className="text-gray-600">{company.investment_type}</span></div>
                          )}
                          {company.funding_amount != null && (
                            <div>Funding requested: <span className="text-gray-600">{company.funding_amount}</span></div>
                          )}
                          {company.available_equity != null && (
                            <div>Equity available: <span className="text-gray-600">{company.available_equity}%</span></div>
                          )}
                          {company.funding_round_status && (
                            <div>Round status: <span className="text-gray-600">{company.funding_round_status}</span></div>
                          )}
                          {company.owner_name && (
                            <div>Owner: <span className="text-gray-600">{company.owner_name}</span></div>
                          )}
                          {company.ceo_name && (
                            <div>CEO: <span className="text-gray-600">{company.ceo_name}</span></div>
                          )}
                          {company.about && (
                            <div className="sm:col-span-2">About: <span className="text-gray-600">{company.about}</span></div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!loading && hasMore && (
              <div className="py-6 text-center">
                <button
                  onClick={() => loadCompanies(false)}
                  className="px-6 py-2 bg-[#0a66c2] text-white rounded-full text-sm font-semibold hover:bg-[#004182]"
                >
                  Load more companies
                </button>
              </div>
            )}
            {loading && (
              <div className="py-4 text-center text-sm text-gray-500">Loading more companies…</div>
            )}
          </div>
        )}
      </section>

      <CreateCompanyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => loadCompanies(true)}
      />
    </div>
  );
}
