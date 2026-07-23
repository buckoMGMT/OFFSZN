// Public athlete profile — opened from post headers and search results.
// Role-gated: coaches never show athletic grade / body-comp fields (none shown here at all).
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Flame, Zap } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";
import FollowButton from "@/components/profile/FollowButton";
import { publicSchool } from "@/lib/privacy";
import { blockAthlete } from "@/lib/blocks";
import { Ban } from "lucide-react";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");

export default function AthleteProfileSheet({ open, onClose, athlete, me, onFollowChange }) {
  useSheetBack(open, onClose);
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    if (!open || !athlete?.id) return;
    setPosts(null);
    base44.entities.SocialPost.filter({ athlete_id: athlete.id, status: "approved" }, "-created_date", 5).then(setPosts);
  }, [open, athlete?.id]);

  if (!open || !athlete) return null;
  const isCoach = athlete.role === "coach";
  const chips = isCoach
    ? ["Coach", ...(athlete.coach_specialties || []).slice(0, 2)]
    : [cap(athlete.sport), athlete.position, publicSchool(athlete), cap(athlete.grade)].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl overflow-y-auto animate-slide-up" onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)', maxHeight: '85vh', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        {/* Header */}
        <div className="flex justify-end px-4 pt-4">
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Identity */}
        <div className="flex flex-col items-center text-center px-6 pb-4">
          <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center mb-3"
            style={{ background: 'var(--surface-3)', border: '2px solid var(--accent)' }}>
            {athlete.avatar_url
              ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
              : <span className="font-anton text-2xl" style={{ color: 'var(--accent)' }}>{(athlete.display_name || "A")[0].toUpperCase()}</span>}
          </div>
          <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>{athlete.display_name}</h2>
          <div className="flex flex-wrap justify-center gap-1.5 mt-2">
            {chips.map(c => (
              <span key={c} className="px-2 py-1 rounded font-elite text-[10px] uppercase tracking-widest"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{c}</span>
            ))}
          </div>
          {athlete.bio && <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)', maxWidth: '40ch' }}>{athlete.bio}</p>}
        </div>

        {/* Stats */}
        <div className="flex gap-3 px-6 mb-4">
          <div className="card-base flex-1 p-3 text-center">
            <Zap size={14} className="mx-auto mb-1" style={{ color: 'var(--accent)' }} />
            <p className="stat-number text-xl">{athlete.total_points || 0}</p>
            <p className="eyebrow mt-1">Points</p>
          </div>
          <div className="card-base flex-1 p-3 text-center">
            <Flame size={14} className="mx-auto mb-1" style={{ color: 'var(--accent)' }} />
            <p className="stat-number text-xl">{athlete.current_streak_days || 0}</p>
            <p className="eyebrow mt-1">Day Streak</p>
          </div>
        </div>

        <div className="px-6 mb-5">
          <FollowButton me={me} targetId={athlete.id} onChange={onFollowChange} />
          {me && me.id !== athlete.id && (
            <button
              onClick={async () => {
                if (!window.confirm(`Block ${athlete.display_name || "this user"}? You won't see their posts and they can't message or follow you.`)) return;
                try { await blockAthlete(athlete.id); onClose?.(); } catch { /* server rejected */ }
              }}
              className="w-full flex items-center justify-center gap-1.5 mt-2 py-2 font-elite text-[9px] uppercase tracking-widest"
              style={{ color: 'var(--negative)' }}>
              <Ban size={10} /> Block user
            </button>
          )}
        </div>

        {/* Recent wins */}
        <div className="px-6">
          <p className="eyebrow mb-2">Recent Wins</p>
          {posts === null ? (
            <div className="space-y-2">
              <div className="skeleton" style={{ width: '100%', height: 44 }} />
              <div className="skeleton" style={{ width: '100%', height: 44 }} />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Nothing posted to The Field yet.</p>
          ) : (
            <div className="space-y-2">
              {posts.map(p => (
                <div key={p.id} className="card-base p-3">
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{p.content}</p>
                  {p.metric_value && !String(p.metric_value).includes("http") && (
                    <p className="stat-number text-sm mt-1" style={{ color: 'var(--accent)' }}>{p.metric_value}</p>
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