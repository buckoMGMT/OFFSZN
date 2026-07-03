import { Users, Trophy, Shield } from "lucide-react";

const typeLabel = {
  high_school: "High School",
  club: "Club",
  college: "College",
  other: "Team",
};

export default function ClanCard({ clan, onClick, isJoined }) {
  return (
    <button
      onClick={onClick}
      className="w-full card-base p-4 flex items-center gap-4 transition-all duration-200 text-left relative overflow-hidden"
      style={{ borderColor: isJoined ? 'var(--accent)' : 'var(--border-subtle)', borderWidth: isJoined ? 2 : 1 }}
    >
      {isJoined && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)' }} />}
      <div className="w-14 h-14 rounded flex items-center justify-center flex-shrink-0" style={{ background: isJoined ? 'var(--accent-subtle)' : 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
        {clan.emblem_url ? (
          <img src={clan.emblem_url} alt="" className="w-full h-full rounded object-cover" />
        ) : (
          <Shield size={24} style={{ color: isJoined ? 'var(--accent)' : 'var(--text-tertiary)' }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-barlow font-bold uppercase truncate" style={{ color: 'var(--text-primary)' }}>{clan.name}</h3>
          {isJoined && <span className="ink-stamp" style={{ fontSize: 8 }}>Joined</span>}
        </div>
        <p className="text-xs font-barlow uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
          {typeLabel[clan.type]} {clan.sport ? `· ${clan.sport}` : ""}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <Users size={12} />
            <span className="text-xs">{(clan.member_ids || []).length} members</span>
          </div>
          <div className="flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            <Trophy size={12} />
            <span className="text-xs font-barlow font-bold tabular-nums">{(clan.total_points || 0).toLocaleString()} pts</span>
          </div>
        </div>
      </div>
    </button>
  );
}