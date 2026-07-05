// Competitive intelligence — how you rank against athletes at your exact position.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function PositionLeaderboard({ athlete }) {
  const [rivals, setRivals] = useState(null);

  useEffect(() => {
    if (!athlete.position) { setRivals([]); return; }
    base44.entities.Athlete.filter({ position: athlete.position }, "-total_points", 10).then(setRivals);
  }, [athlete.id, athlete.position]);

  if (!athlete.position) return (
    <div className="card-base p-4">
      <p className="eyebrow mb-1">Position Leaderboard</p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Set your position on your player card to see how you stack up against your rivals.</p>
    </div>
  );

  if (!rivals) return <div className="skeleton h-32 rounded-lg" />;

  return (
    <div className="card-base p-4">
      <p className="eyebrow mb-3">Top {athlete.position}s — By Points</p>
      <div className="space-y-2">
        {rivals.map((r, i) => {
          const isMe = r.id === athlete.id;
          return (
            <div key={r.id} className="flex items-center gap-3 rounded px-2 py-1.5" style={{ background: isMe ? 'var(--accent-subtle)' : 'transparent', border: isMe ? '1px solid var(--accent)' : '1px solid transparent' }}>
              <span className="tabular-nums text-xs font-semibold w-5" style={{ color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{i + 1}</span>
              <span className="font-work text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {r.display_name}{isMe && <span className="ink-stamp ml-2" style={{ fontSize: 8 }}>You</span>}
              </span>
              <span className="tabular-nums text-xs" style={{ color: 'var(--text-secondary)' }}>{(r.total_points || 0).toLocaleString()} pts</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}