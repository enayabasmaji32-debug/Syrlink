import React from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Calendar, Hash, Newspaper, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { toast } from 'sonner';

export default function Network() {
  const { invitations, acceptInvite, ignoreInvite, people, sendConnect, pendingSent, connections } = useApp();

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4 grid grid-cols-12 gap-6">
      {/* Left rail */}
      <aside className="hidden lg:block lg:col-span-3">
        <div className="li-card p-3 text-sm">
          <h2 className="font-semibold mb-2">Manage my network</h2>
          <ul className="space-y-1">
            {[
              { icon: Users, label: 'Connections', count: (connections?.size || 0) + 487 },
              { icon: UserPlus, label: 'Following & followers', count: 1024 },
              { icon: Users, label: 'Groups', count: 12 },
              { icon: Calendar, label: 'Events', count: 4 },
              { icon: Hash, label: 'Hashtags', count: 16 },
              { icon: Newspaper, label: 'Newsletters', count: 6 },
            ].map((item) => (
              <li key={item.label} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 cursor-pointer">
                <span className="flex items-center gap-3 text-gray-700">
                  <item.icon className="w-4 h-4 text-gray-500" />
                  {item.label}
                </span>
                <span className="text-gray-600">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Center column */}
      <div className="col-span-12 lg:col-span-9 space-y-3">
        {/* Invitations */}
        <section className="li-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">Invitations ({invitations?.length || 0})</h2>
            <Link to="#" className="text-sm font-semibold text-gray-600 hover:bg-gray-100 px-2 py-1 rounded">See all</Link>
          </div>
          <ul className="divide-y divide-gray-100 mt-2">
            {(!invitations || invitations.length === 0) && (
              <li className="py-6 text-center text-sm text-gray-500">No pending invitations. ✨</li>
            )}
            {Array.isArray(invitations) && invitations.filter((inv) => inv && inv.id).map((inv) => {
              const invUser = inv?.user || { id: '', name: 'Unknown', avatar: '', headline: '' };
              return (
                <li key={inv.id} className="py-3 flex items-start gap-3">
                  <Link to={invUser.id ? `/in/${invUser.id}` : '#'}>
                    <img src={invUser.avatar || ''} alt={invUser.name} className="w-14 h-14 rounded-full object-cover" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={invUser.id ? `/in/${invUser.id}` : '#'} className="font-semibold text-sm hover:underline">{invUser.name}</Link>
                    <p className="text-xs text-gray-600 line-clamp-2">{invUser.headline}</p>
                    {inv?.note && <p className="text-xs text-gray-700 mt-1 italic">"{inv.note}"</p>}
                    <p className="text-[11px] text-gray-500 mt-0.5">{inv?.mutual ?? 0} mutual connections</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await ignoreInvite(inv.id);
                          toast('Invitation ignored');
                        } catch (e) {
                          toast.error(e?.response?.data?.detail || 'Failed to ignore invitation');
                        }
                      }}
                      className="text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-full px-4 py-1"
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await acceptInvite(inv.id);
                          toast.success(`You are now connected with ${invUser.name}`);
                        } catch (e) {
                          toast.error(e?.response?.data?.detail || 'Failed to accept invitation');
                        }
                      }}
                      className="text-sm font-semibold text-[#0a66c2] border border-[#0a66c2] hover:bg-[#0a66c2]/10 rounded-full px-4 py-1"
                    >
                      Accept
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* People you may know */}
        <section className="li-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-base">People you may know based on your activity</h2>
            <button className="text-sm font-semibold text-gray-600 hover:bg-gray-100 px-2 py-1 rounded flex items-center gap-1">
              See all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
            {Array.isArray(people) && people.filter((p) => p && typeof p === 'object' && p.id).map((p) => {
              const pending = pendingSent.has(p.id);
              const conn = connections.has(p.id);
              return (
                <li key={p.id} className="border border-gray-200 rounded-lg overflow-hidden hover-lift bg-white">
                  <div
                    className="h-14 bg-cover bg-center"
                    style={{ backgroundImage: `url(${p.cover || ''})` }}
                  />
                  <div className="px-3 pb-3 -mt-8 text-center">
                    <Link to={`/in/${p.id}`}>
                      <img src={p.avatar || ''} alt={p.name || 'User'} className="w-16 h-16 rounded-full border-2 border-white object-cover mx-auto" />
                    </Link>
                    <Link to={`/in/${p.id}`} className="block mt-2 font-semibold text-sm hover:underline line-clamp-1">
                      {p.name || 'Unknown User'}
                    </Link>
                    <p className="text-xs text-gray-600 line-clamp-2 h-8 mt-0.5">{p.headline || ''}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{p.mutual ?? 0} mutual connections</p>
                    <button
                      onClick={() => {
                        sendConnect(p.id);
                        toast(`Connection request sent to ${p.name || 'user'}`);
                      }}
                      disabled={pending || conn}
                      className="mt-3 w-full inline-flex items-center justify-center gap-1 border border-[#0a66c2] text-[#0a66c2] font-semibold text-sm rounded-full px-3 py-1 hover:bg-[#0a66c2]/10 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {conn ? 'Connected' : pending ? 'Pending' : (<><UserPlus className="w-4 h-4" /> Connect</>)}
                    </button>
                  </div>
                </li>
              );
            })}
            {(!Array.isArray(people) || people.length === 0) && (
              <li className="col-span-full py-6 text-center text-sm text-gray-500">No suggested connections available right now.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}