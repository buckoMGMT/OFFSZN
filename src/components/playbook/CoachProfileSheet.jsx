// Coach storefront sheet — verified coach identity, stats, and their video catalog.
import { X, BadgeCheck, Eye, Play, BellRing, BellPlus } from "lucide-react";
import PricePill from "@/components/monetization/PricePill";
import CoachServiceSection from "@/components/playbook/CoachServiceSection";

function fmt(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n || 0}`;
}

export default function CoachProfileSheet({ open, onClose, coach, videos = [], onSelectVideo, isSubscribed, onToggleSubscribe }) {
  if (!open || !coach) return null;
  const totalViews = videos.reduce((s, v) => s + (v.views || 0), 0);
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={coach.avatar_url} alt={coach.display_name} className="w-14 h-14 rounded-full object-cover" style={{ border: '2px solid var(--accent)' }} />
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-work text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{coach.display_name}</h2>
                  <BadgeCheck size={15} style={{ color: 'var(--accent)' }} />
                </div>
                <p className="font-elite text-[10px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  Verified Coach{coach.school ? ` · ${coach.school}` : ""}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
              <X size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {coach.bio && <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{coach.bio}</p>}

          <CoachServiceSection coach={coach} />

          {onToggleSubscribe && (
            <button onClick={() => onToggleSubscribe(coach)}
              className="w-full flex items-center justify-center gap-2 mb-4 py-2.5 rounded font-elite text-[10px] uppercase tracking-widest"
              style={isSubscribed
                ? { background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }
                : { background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }}>
              {isSubscribed ? <><BellRing size={12} style={{ color: 'var(--accent)' }} /> Subscribed — Notifications On</> : <><BellPlus size={12} /> Subscribe</>}
            </button>
          )}

          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: "Drills", value: videos.length },
              { label: "Total Views", value: fmt(totalViews) },
              { label: "Points", value: fmt(coach.total_points) },
            ].map(s => (
              <div key={s.label} className="card-base p-3 text-center">
                <p className="stat-number text-lg tabular-nums">{s.value}</p>
                <p className="eyebrow mt-1" style={{ fontSize: 9 }}>{s.label}</p>
              </div>
            ))}
          </div>

          <p className="eyebrow mb-2">From this Coach</p>
          <div className="space-y-2">
            {videos.map(v => (
              <button key={v.id} onClick={() => onSelectVideo?.(v)}
                className="card-tappable w-full p-3 flex items-center gap-3 text-left">
                <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                  <Play size={13} fill="currentColor" style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.title}</p>
                  <span className="flex items-center gap-1 tabular-nums text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    <Eye size={9} /> {fmt(v.views || 0)} views
                  </span>
                </div>
                {v.price_usd > 0
                  ? <PricePill price={`$${v.price_usd.toFixed(2)}`} />
                  : <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--positive)' }}>Free</span>}
              </button>
            ))}
            {videos.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No published drills yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}