// "Coaches for you" strip — deterministic match (src/lib/forYou.js), instant.
// Only discoverable coaches (pfp + bio gate) surface. Tap → coach profile sheet.
import { useMemo } from "react";
import { BadgeCheck, Sparkles } from "lucide-react";
import { pickCoachesForYou } from "@/lib/forYou";

export default function CoachesForYou({ athlete, coaches, subscribedIds = [], onOpen }) {
  const daySeed = new Date().toISOString().slice(0, 10);
  const picks = useMemo(
    () => pickCoachesForYou(athlete, coaches, subscribedIds, { count: 6 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [athlete?.id, coaches.length, subscribedIds.length, daySeed]
  );

  if (!picks.length) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={13} style={{ color: 'var(--accent)' }} />
        <p className="eyebrow" style={{ color: 'var(--accent)' }}>Coaches for you</p>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide">
        {picks.map((c) => (
          <button key={c.id} onClick={() => onOpen(c)}
            className="flex-shrink-0 w-24 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full overflow-hidden mb-1.5" style={{ border: c.is_coach_verified ? '2px solid var(--accent)' : '1px solid var(--border-strong)' }}>
              <img src={c.avatar_url} alt={c.display_name} className="w-full h-full object-cover" />
            </div>
            <span className="flex items-center gap-0.5 font-work text-[11px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
              <span className="truncate" style={{ maxWidth: 70 }}>{c.display_name}</span>
              {c.is_coach_verified && <BadgeCheck size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
            </span>
            <span className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
              {c.sport ? c.sport.replace(/_/g, " ") : "coach"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}