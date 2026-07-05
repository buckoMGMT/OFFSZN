// Bottom sheet notification center — covers athlete + coach notification types.
import { X, UserPlus, Play, DollarSign, BadgeCheck, TrendingUp, Wallet, Flame, Trophy, Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const TYPE_META = {
  new_subscriber: { Icon: UserPlus, label: "Subscriber" },
  new_video: { Icon: Play, label: "New Drop" },
  video_purchased: { Icon: DollarSign, label: "Sale" },
  video_approved: { Icon: BadgeCheck, label: "Approved" },
  milestone_views: { Icon: TrendingUp, label: "Milestone" },
  payout: { Icon: Wallet, label: "Payout" },
  streak_risk: { Icon: Flame, label: "Streak" },
  clan_challenge: { Icon: Trophy, label: "Clan" },
};

export default function NotificationsSheet({ open, onClose, notifications }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up max-h-[80vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b" style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-anton text-lg uppercase" style={{ color: 'var(--text-primary)' }}>Notifications</h2>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="px-4 py-3 space-y-2">
          {notifications.length === 0 && (
            <div className="text-center py-12">
              <Bell size={28} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
              <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All caught up.</p>
              <p className="font-work text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Subscriber activity, sales, and new drops land here.</p>
            </div>
          )}
          {notifications.map(n => {
            const meta = TYPE_META[n.type] || TYPE_META.new_video;
            return (
              <div key={n.id} className="card-base p-3 flex items-start gap-3" style={{ borderLeft: n.is_read ? '1px solid var(--border-subtle)' : '3px solid var(--accent)' }}>
                {n.actor_avatar
                  ? <img src={n.actor_avatar} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border-strong)' }} />
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                      <meta.Icon size={15} style={{ color: 'var(--accent)' }} />
                    </div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                    <span className="font-elite text-[8px] uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)' }}>{meta.label}</span>
                  </div>
                  {n.body && <p className="font-work text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.body}</p>}
                  <p className="font-elite text-[9px] uppercase tracking-wide mt-1" style={{ color: 'var(--text-tertiary)' }}>
                    {formatDistanceToNow(new Date(n.created_date), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}