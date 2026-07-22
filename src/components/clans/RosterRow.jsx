// Jersey-number roster row (image-6 pattern): [number chip] Name · pos/class · pts.
// Tap → opens that athlete's profile sheet.
export default function RosterRow({ member, index, isMe, onOpen }) {
  const number = member.jersey_number || String(index + 1);
  const meta = [member.position, member.grade].filter(Boolean).map((s) => String(s).replace(/_/g, " ")).join(" · ") || member.sport?.replace(/_/g, " ") || "Athlete";

  return (
    <button
      onClick={() => onOpen?.(member)}
      className="w-full card-tappable p-2.5 flex items-center gap-3 text-left"
      style={{ borderColor: isMe ? 'var(--accent)' : 'var(--border-subtle)', borderWidth: isMe ? 2 : 1 }}
    >
      {/* Number chip */}
      <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
        <span className="font-anton text-sm tabular-nums" style={{ color: isMe ? 'var(--accent)' : 'var(--text-secondary)' }}>{number}</span>
      </div>
      {member.avatar_url
        ? <img src={member.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border-strong)' }} />
        : <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-anton text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{(member.display_name || "?")[0]}</div>}
      <div className="flex-1 min-w-0">
        <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {member.display_name}{isMe && <span className="ink-stamp ml-2" style={{ fontSize: 8 }}>You</span>}
        </p>
        <p className="font-elite text-[9px] uppercase tracking-wide truncate" style={{ color: 'var(--text-tertiary)' }}>{meta}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="stat-number text-base tabular-nums" style={{ color: 'var(--text-primary)' }}>{(member.total_points || 0).toLocaleString()}</p>
        <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>pts</p>
      </div>
    </button>
  );
}