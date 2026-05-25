import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Camera,
  CheckCircle2,
  MapPin,
  Pencil,
  MoreHorizontal,
  Briefcase,
  GraduationCap,
  Languages,
  Award,
  MessageSquare,
  UserPlus,
  UserCheck,
  Clock,
  Building2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import ReportModal from '../components/ReportModal';
import VerificationRequest from '../components/VerificationRequest';
import { RecommendationsSection, EndorsementsSection } from '../components/ProfessionalSections';
import { usersApi } from '../api';
import { showImageLightbox } from '../components/ui/ImageLightbox';

function Section({ title, action, children }) {
  return (
    <section className="li-card p-5">
      <div className={`flex items-center mb-3 ${action ? 'justify-between' : ''}`}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Profile() {
  const { userId } = useParams();
  const { user: me, connections, pendingSent, sendConnect, people } = useApp();
  const [fetched, setFetched] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const [verifOpen, setVerifOpen] = useState(false);

  const isMe = !userId || userId === 'me' || userId === me?.id;
  useEffect(() => {
    if (isMe || !userId) { setFetched(null); return; }
    usersApi.get(userId).then(setFetched).catch(() => setFetched(null));
  }, [userId, isMe]);
  const profile = isMe ? me : (fetched || people.find((p) => p.id === userId) || me);
  if (!profile) return null;
  const isConnected = !isMe && connections.has(profile.id);
  const isPending = !isMe && pendingSent.has(profile.id);

  return (
    <div className="max-w-[1128px] mx-auto px-2 sm:px-4 py-4 grid grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-8 space-y-2">
        {/* Top card */}
        <section className="li-card overflow-visible">
          <div className="relative">
            <div
              className="h-48 bg-cover bg-center cursor-pointer"
              style={{ backgroundImage: `url(${profile.cover || me.cover})` }}
              onClick={() => (profile.cover || me.cover) && showImageLightbox(profile.cover || me.cover, `${profile.name} - cover`)}
            />
            {isMe && (
              <button className="absolute top-3 right-3 bg-white rounded-full p-2 shadow hover:bg-gray-100">
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="px-6 pb-5 pt-4">
            <div className="flex items-start justify-between gap-4">
              <img
                src={profile.avatar}
                alt={profile.name}
                onClick={() => profile.avatar && showImageLightbox(profile.avatar, profile.name)}
                className="w-32 h-32 rounded-full border-4 border-white object-cover object-center bg-white shadow-md flex-shrink-0 cursor-pointer"
                data-testid="profile-avatar"
              />
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold leading-tight">{profile.name}</h1>
                {profile.verified && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                    <CheckCircle2 className="w-4 h-4 text-[#0a66c2]" fill="#0a66c2" stroke="white" />
                    Verified
                  </span>
                )}
                <span className="text-xs text-gray-500">· He/Him</span>
              </div>
              <p className="mt-1 text-[15px]">{profile.headline}</p>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> {profile.location || 'Syria'} ·
                <span className="text-[#0a66c2] font-semibold hover:underline cursor-pointer ml-1">Contact info</span>
              </p>
              {profile.github && (
                <p className="text-sm text-[#0a66c2] mt-1">
                  <a href={profile.github} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    GitHub profile
                  </a>
                </p>
              )}
              <p className="text-sm font-semibold text-[#0a66c2] mt-1 hover:underline cursor-pointer">
                {profile.connections || 0}+ connections</p>
              {isMe && !profile.verified && (
                <button onClick={() => setVerifOpen(true)} data-testid="request-verification-btn"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold border border-[#0a66c2] text-[#0a66c2] rounded-full px-3 py-1 hover:bg-[#0a66c2]/10">
                  <span>✓ Get verified</span>
                </button>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-4">
                {isMe ? (
                  <>
                    <Link to="/me/edit" className="bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold text-sm rounded-full px-4 py-1.5 flex items-center gap-1">
                      <Pencil className="w-4 h-4" /> Edit profile
                    </Link>
                    <Link to="/career-interests" className="border border-gray-700 text-gray-700 hover:bg-gray-100 font-semibold text-sm rounded-full px-4 py-1.5">Open to</Link>
                    <a href="https://help.syrlink.com" target="_blank" rel="noopener noreferrer" className="border border-gray-500 text-gray-700 hover:bg-gray-100 font-semibold text-sm rounded-full px-4 py-1.5">Resources</a>
                  </>
                ) : (
                  <>
                    {!isConnected && !isPending && (
                      <button onClick={() => sendConnect(profile.id)} className="bg-[#0a66c2] hover:bg-[#004182] text-white font-semibold text-sm rounded-full px-4 py-1.5 flex items-center gap-1">
                        <UserPlus className="w-4 h-4" /> Connect
                      </button>
                    )}
                    {isPending && (
                      <button disabled className="bg-gray-200 text-gray-600 font-semibold text-sm rounded-full px-4 py-1.5 flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Pending
                      </button>
                    )}
                    {isConnected && (
                      <button disabled className="bg-gray-200 text-gray-700 font-semibold text-sm rounded-full px-4 py-1.5 flex items-center gap-1">
                        <UserCheck className="w-4 h-4" /> Connected
                      </button>
                    )}
                    <Link to={`/messaging/${profile.id}`} className="border border-[#0a66c2] text-[#0a66c2] hover:bg-[#0a66c2]/10 font-semibold text-sm rounded-full px-4 py-1.5 flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" /> Message
                    </Link>
                    <a href="#" className="border border-gray-700 text-gray-700 hover:bg-gray-100 font-semibold text-sm rounded-full px-4 py-1.5">More options</a>
                    <button onClick={() => setShowReport(true)} className="border border-red-500 text-red-600 hover:bg-red-50 font-semibold text-sm rounded-full px-4 py-1.5 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> Report
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Analytics */}
        {isMe && (
          <Section title="Analytics" action={null}>
            <p className="text-xs text-gray-500 -mt-2 mb-3">Private to you</p>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="font-semibold">{profile.profile_views || 0} profile views</div><div className="text-xs text-gray-600">Discover who's viewed your profile.</div></div>
              <div><div className="font-semibold">{profile.post_impressions || 0} post impressions</div><div className="text-xs text-gray-600">Past 7 days</div></div>
              <div><div className="font-semibold">{profile.search_appearances || 0} search appearances</div><div className="text-xs text-gray-600">Discover how often you appear in searches.</div></div>
            </div>
          </Section>
        )}}

        {/* About */}
        <Section title="About">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{profile.about || 'No about info yet.'}</p>
        </Section>

        {/* Experience */}
        <Section title="Experience">
          <ul className="space-y-5">
            {(profile.experience || []).map((e, idx) => (
              <li key={e.id} className="flex gap-3">
                <img src={e.logo} alt={e.company} onError={(ev) => (ev.target.style.display = 'none')} className="w-12 h-12 rounded object-contain bg-gray-50 border border-gray-100" />
                <div className="flex-1">
                  <h3 className="font-semibold text-[15px]">{e.title}</h3>
                  <div className="text-sm">{e.company} · <span className="text-gray-600">{e.type}</span></div>
                  <div className="text-xs text-gray-600">{e.duration}</div>
                  <div className="text-xs text-gray-600">{e.location}</div>
                  <p className="text-sm mt-2">{e.description}</p>
                  {e.company && (
                    <div className="mt-3">
                      <Link
                        to={`/companies?q=${encodeURIComponent(e.company)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#0a66c2] hover:underline"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        Search company
                      </Link>
                    </div>
                  )}
                </div>
                {idx === 0 && (
                  <Briefcase className="w-4 h-4 text-gray-400" />
                )}
              </li>
            ))}
          </ul>
        </Section>

        {/* Education */}
        <Section title="Education">
          <ul className="space-y-5">
            {(profile.education || []).map((ed) => (
              <li key={ed.id} className="flex gap-3">
                <img src={ed.logo} alt={ed.school} onError={(ev) => (ev.target.style.display = 'none')} className="w-12 h-12 rounded object-contain bg-gray-50 border border-gray-100" />
                <div className="flex-1">
                  <h3 className="font-semibold text-[15px]">{ed.school}</h3>
                  <div className="text-sm">{ed.degree}</div>
                  <div className="text-xs text-gray-600">{ed.duration}</div>
                </div>
                <GraduationCap className="w-4 h-4 text-gray-400" />
              </li>
            ))}
          </ul>
        </Section>

        {/* Skills */}
        <Section title="Skills">
          <ul className="divide-y divide-gray-100">
            {(profile.skills || []).slice(0, 6).map((s) => (
              <li key={s} className="py-2 flex items-start gap-2">
                <Award className="w-4 h-4 text-gray-500 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-sm">{s}</div>
                  <div className="text-xs text-gray-600">Endorsed by {Math.floor(Math.random() * 40 + 5)} colleagues</div>
                </div>
              </li>
            ))}
          </ul>
          <button className="w-full text-center text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded py-2 mt-2">Show all {(profile.skills || []).length} skills →</button>
        </Section>

        {/* Languages */}
        <Section title="Languages">
          <ul className="space-y-3">
            {(profile.languages || []).map((l) => (
              <li key={l} className="flex items-start gap-2">
                <Languages className="w-4 h-4 mt-1 text-gray-500" />
                <div className="font-semibold text-sm">{l}</div>
              </li>
            ))}
          </ul>
        </Section>

        {/* Recommendations */}
        <RecommendationsSection 
          userId={profile.id} 
          isMe={isMe}
        />

        {/* Endorsements */}
        <EndorsementsSection 
          userId={profile.id} 
          isMe={isMe}
          skills={profile.skills || []}
        />
      </div>

      {/* Right rail */}
      <div className="hidden lg:block lg:col-span-4 space-y-2">
        <div className="li-card p-4">
          <h3 className="font-semibold text-base mb-2">People you may know</h3>
          <ul className="divide-y divide-gray-100">
            {people.slice(0, 5).map((p) => (
              <li key={p.id} className="py-3 flex items-start gap-2">
                <Link to={`/in/${p.id}`}><img src={p.avatar} alt={p.name} className="w-12 h-12 rounded-full object-cover" /></Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/in/${p.id}`} className="font-semibold text-sm hover:underline line-clamp-1">{p.name}</Link>
                  <p className="text-xs text-gray-600 line-clamp-2">{p.headline}</p>
                  <button onClick={() => sendConnect(p.id)} disabled={pendingSent.has(p.id)} className="mt-1 inline-flex items-center gap-1 border border-gray-700 text-gray-700 font-semibold text-xs rounded-full px-3 py-1 hover:bg-gray-100 disabled:opacity-60">
                    {pendingSent.has(p.id) ? 'Pending' : (<><UserPlus className="w-3 h-3" /> Connect</>)}
                  </button>
                </div>
                <button className="text-gray-500 hover:bg-gray-100 rounded-full p-1"><MoreHorizontal className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        </div>

        <div className="li-card p-4">
          <h3 className="font-semibold text-base mb-2">Promoted</h3>
          <div className="text-sm">
            <p className="font-semibold">Level up your career</p>
            <p className="text-gray-600 text-xs mt-1">Try LinkedIn Premium for free — access courses, insights, and InMail credits.</p>
            <button className="mt-3 border border-gray-700 text-gray-700 hover:bg-gray-100 font-semibold text-xs rounded-full px-3 py-1">Try for free</button>
          </div>
        </div>
      </div>

      {verifOpen && <VerificationRequest onClose={() => setVerifOpen(false)} />}
      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="profile"
        targetId={profile.id}
        targetName={profile.name}
      />
    </div>
  );
}