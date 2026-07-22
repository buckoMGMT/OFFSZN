// Your friends list — the athletes you follow. Remove works inline.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Users, UserMinus, Swords } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";
import PvPChallenges from "@/components/profile/PvPChallenges";
import { createPvpChallenge } from "@/lib/pvp";

const PVP_DURATIONS = [3, 7, 14];

export default function FriendsSheet({ open, onClose, athlete, onUpdated }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  // 1v1 — which friend row has the duration picker open
  const [challengeTarget, setChallengeTarget] = useState(null);
  const [pvpMsg, setPvpMsg] = useState("");
  const [pvpBusy, setPvpBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useSheetBack(open, onClose);

  const startChallenge = async (friend, days) => {
    setPvpBusy(true);
    setPvpMsg("");
    try {
      await createPvpChallenge(athlete, friend, days);
      setChallengeTarget(null);
      setRefreshKey(k => k + 1);
    } catch (e) {
      setPvpMsg(e?.message === "active_exists"
        ? "You've already got a live or pending challenge with them."
        : "Couldn't send it — try again.");
    } finally {
      setPvpBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !athlete) return;
    const ids = athlete.friends || [];
    if (ids.length === 0) { setFriends([]); setLoading(false); return; }
    setLoading(true);
    base44.entities.Athlete.filter({ id: { $in: ids } }, "-created_date", 100)
      .then(list => { setFriends(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, athlete]);

  const removeFriend = async (friendId) => {
    const next = (athlete.friends || []).filter(id => id !== friendId);
    setFriends(prev => prev.filter(f => f.id !== friendId));
    const updated = await base44.entities.Athlete.update(athlete.id, { friends: next });
    onUpdated?.(updated);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up flex flex-col"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="font-anton text-lg uppercase" style={{ color: 'var(--text-primary)' }}>
              Friends {friends.length > 0 && `(${friends.length})`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
          {/* Live + past 1v1 challenges */}
          {athlete && <PvPChallenges athlete={athlete} refreshKey={refreshKey} />}
          {loading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-md)' }} />)}
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-10">
              <p className="font-anton text-lg uppercase mb-1" style={{ color: 'var(--text-primary)' }}>No Friends Yet</p>
              <p className="font-work text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Find athletes in search and on The Field — follow them and they show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {friends.map(f => (
                <div key={f.id} className="rounded border"
                  style={{ background: 'var(--surface-1)', borderColor: challengeTarget === f.id ? 'var(--accent)' : 'var(--border-subtle)' }}>
                  <div className="flex items-center gap-3 p-2.5">
                    {f.avatar_url
                      ? <img src={f.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border-strong)' }} />
                      : <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-work text-sm font-semibold"
                          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{(f.display_name || "?")[0]}</div>}
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{f.display_name}</p>
                      <p className="font-elite text-[9px] uppercase tracking-widest truncate" style={{ color: 'var(--text-tertiary)' }}>
                        {[f.sport?.replace(/_/g, " "), f.position].filter(Boolean).join(" · ") || "Athlete"}
                      </p>
                    </div>
                    {/* 1v1 — race this friend to the most points */}
                    <button onClick={() => { setChallengeTarget(challengeTarget === f.id ? null : f.id); setPvpMsg(""); }}
                      aria-label={`Challenge ${f.display_name}`}
                      className="p-2 rounded flex-shrink-0"
                      style={{ background: challengeTarget === f.id ? 'var(--accent-subtle)' : 'var(--surface-2)', border: `1px solid ${challengeTarget === f.id ? 'var(--accent)' : 'var(--border-subtle)'}` }}>
                      <Swords size={14} style={{ color: challengeTarget === f.id ? 'var(--accent)' : 'var(--text-secondary)' }} />
                    </button>
                    <button onClick={() => removeFriend(f.id)} aria-label={`Remove ${f.display_name}`}
                      className="p-2 rounded flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                      <UserMinus size={14} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </div>
                  {challengeTarget === f.id && (
                    <div className="px-2.5 pb-2.5">
                      <p className="eyebrow mb-2">Send a challenge offer — they get 24h to accept</p>
                      <div className="flex gap-2">
                        {PVP_DURATIONS.map(d => (
                          <button key={d} onClick={() => startChallenge(f, d)} disabled={pvpBusy}
                            className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', opacity: pvpBusy ? 0.6 : 1 }}>
                            {d} days
                          </button>
                        ))}
                      </div>
                      {pvpMsg && <p className="text-xs mt-2" style={{ color: 'var(--negative)' }}>{pvpMsg}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}