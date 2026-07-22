// Your friends list — the athletes you follow. Remove works inline.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Users, UserMinus } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";

export default function FriendsSheet({ open, onClose, athlete, onUpdated }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  useSheetBack(open, onClose);

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
                <div key={f.id} className="flex items-center gap-3 p-2.5 rounded border"
                  style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
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
                  <button onClick={() => removeFriend(f.id)} aria-label={`Remove ${f.display_name}`}
                    className="p-2 rounded flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
                    <UserMinus size={14} style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}