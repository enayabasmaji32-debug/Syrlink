import React, { useState, useEffect } from 'react';
import { Award, Heart, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { recommendationsApi, endorsementsApi } from '../api';

export function RecommendationsSection({ userId, isMe }) {
  const [recs, setRecs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    recommendationsApi.getFor(userId)
      .then(setRecs)
      .catch(() => setRecs([]));
  }, [userId]);

  const handleAdd = async () => {
    if (!text.trim()) {
      toast.error('Recommendation cannot be empty');
      return;
    }
    setLoading(true);
    try {
      const newRec = await recommendationsApi.give(userId, text);
      setRecs([newRec, ...recs]);
      setText('');
      setShowForm(false);
      toast.success('Recommendation added!');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add recommendation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="li-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Award className="w-5 h-5" /> Recommendations ({recs.length})
        </h2>
        {!isMe && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-[#0a66c2] hover:bg-[#0a66c2]/10 p-1.5 rounded"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {showForm && !isMe && (
        <div className="mb-4 p-3 border border-gray-300 rounded">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a recommendation..."
            className="w-full text-sm border border-gray-300 rounded p-2 resize-none"
            rows={3}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleAdd}
              disabled={loading}
              className="bg-[#0a66c2] hover:bg-[#004182] text-white text-sm font-semibold px-4 py-1 rounded"
            >
              {loading ? 'Saving...' : 'Send'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-700 text-sm font-semibold px-4 py-1 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {recs.length === 0 ? (
          <p className="text-sm text-gray-500">No recommendations yet</p>
        ) : (
          recs.map((rec) => (
            <div key={rec.id} className="border-b pb-3 last:border-b-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0a66c2]">{rec.from_user?.name || 'Unknown'}</p>
                  {rec.from_user?.headline && (
                    <p className="text-xs text-gray-500 mb-1">{rec.from_user.headline}</p>
                  )}
                  <p className="text-sm text-gray-700">{rec.text}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function EndorsementsSection({ userId, isMe, skills = [] }) {
  const [endorsed, setEndorsed] = useState({});
  const [loadingSkill, setLoadingSkill] = useState(null);

  useEffect(() => {
    if (!userId) return;
    endorsementsApi.getFor(userId)
      .then(setEndorsed)
      .catch(() => setEndorsed({}));
  }, [userId]);

  const handleEndorse = async (skill) => {
    setLoadingSkill(skill);
    try {
      const result = await endorsementsApi.endorse(userId, skill);
      setEndorsed((prev) => ({
        ...prev,
        [skill]: {
          count: result.count,
          givers: prev[skill]?.givers || [],
        },
      }));
      toast.success(`${skill} endorsed!`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to endorse');
    } finally {
      setLoadingSkill(null);
    }
  };

  const skillList = skills.length > 0 ? skills : Object.keys(endorsed);

  return (
    <div className="li-card p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-red-500" /> Endorsed skills
      </h2>

      {skillList.length === 0 ? (
        <p className="text-sm text-gray-500">No skills listed yet</p>
      ) : (
        <div className="space-y-4">
          {skillList.map((skill) => {
            const count = endorsed[skill]?.count || 0;
            const givers = endorsed[skill]?.givers || [];
            return (
              <div key={skill} className="border-b pb-3 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{skill}</h3>
                    <p className="text-xs text-gray-500">Endorsed by {count} colleague{count === 1 ? '' : 's'}</p>
                  </div>
                  {!isMe && (
                    <button
                      onClick={() => handleEndorse(skill)}
                      disabled={loadingSkill === skill}
                      className="text-xs text-[#0a66c2] hover:underline font-semibold"
                    >
                      {loadingSkill === skill ? 'Saving...' : 'Endorse'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {givers.slice(0, 3).map((giver) => (
                    <img
                      key={giver.id}
                      src={giver.avatar}
                      alt={giver.name}
                      title={giver.name}
                      className="w-6 h-6 rounded-full object-cover border border-white"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
