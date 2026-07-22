// "Picked for your SZN" — horizontal drill row at the top of Explore.
// Deterministic scoring (src/lib/forYou.js), refreshed daily, completed excluded.
import { useMemo } from "react";
import { Clock, Sparkles } from "lucide-react";
import { pickDrillsForYou } from "@/lib/forYou";

export default function ForYouRow({ athlete, programs, onSelect }) {
  // Daily-stable pick: seed changes once per calendar day so it doesn't reshuffle every render
  const daySeed = new Date().toISOString().slice(0, 10);
  const picks = useMemo(
    () => pickDrillsForYou(athlete, programs, { count: 6 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [athlete?.id, daySeed, programs.length]
  );

  if (!picks.length) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={13} style={{ color: 'var(--accent)' }} />
        <p className="eyebrow" style={{ color: 'var(--accent)' }}>Picked for your SZN</p>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
        {picks.map((p) => (
          <button key={p.id} onClick={() => onSelect(p)}
            className="flex-shrink-0 w-40 text-left rounded-lg overflow-hidden card-tappable"
            style={{ border: '1px solid var(--border-subtle)' }}>
            <div className="relative h-24 w-full">
              <img src={p.cover} alt={p.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,11,13,0.85), transparent 70%)' }} />
              <span className="absolute bottom-1.5 left-2 font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{p.category}</span>
            </div>
            <div className="p-2.5">
              <p className="font-work text-xs font-semibold leading-tight mb-1" style={{ color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</p>
              <span className="flex items-center gap-1 font-elite text-[9px] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                <Clock size={9} /> {p.duration} min
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}