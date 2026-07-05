import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Flame } from "lucide-react";

// Roster list of the athlete's own team members
export default function TeamRoster({ clan, athleteId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clan?.id) return;
    base44.entities.Athlete.filter({ clan_id: clan.id }, "-total_points", 50).then(list => {
      setMembers(list);
      setLoading(false);
    });
  }, [clan?.id]);

  if (loading) return <div className="skeleton mb-6" style={{ height: 120 }} />;
  if (members.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="font-anton text-2xl uppercase mb-3" style={{ color: 'var(--text-primary)' }}>{clan.name} Roster</h2>
      <div className="space-y-2">
        {members.map((m, i) => {
          const isMe = m.id === athleteId;
          return (
            <div key={m.id} className="card-base p-3 flex items-center gap-3"
              style={{ borderColor: isMe ? 'var(--accent)' : 'var(--border-subtle)', borderWidth: isMe ? 2 : 1 }}>
              <span className="stat-number text-sm w-5 text-center flex-shrink-0" style={{ color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{i + 1}</span>
              {m.avatar_url
                ? <img src={m.avatar_url} alt={m.display_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border-strong)' }} />
                : <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-anton text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{(m.display_name || "?")[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {m.display_name}
                  {isMe && <span className="ink-stamp ml-2" style={{ fontSize: 8 }}>You</span>}
                </p>
                <p className="font-elite text-[9px] uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{m.position || m.sport} · {m.grade}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0" style={{ color: 'var(--warning)' }}>
                <Flame size={11} />
                <span className="tabular-nums text-xs">{m.current_streak_days || 0}</span>
              </div>
              <div className="text-right flex-shrink-0 w-14">
                <p className="stat-number text-base">{(m.total_points || 0).toLocaleString()}</p>
                <p className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>pts</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}