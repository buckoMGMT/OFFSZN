// Studio Subscribers — active paid members with LIVE minor status, guardian
// indicator, and SLA clock. Thread-opens route through CoachChatSheet → dmGuard.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, ShieldCheck, ShieldAlert, Clock } from "lucide-react";
import CoachChatSheet from "@/components/messaging/CoachChatSheet";

export default function StudioSubscribersTab({ athlete }) {
  const [data, setData] = useState(null);
  const [active, setActive] = useState(null);

  useEffect(() => {
    base44.functions.invoke("studioSubscribers", {})
      .then(r => setData(r.data))
      .catch(() => setData({ subscribers: [], sla_hours: 48 }));
  }, []);

  if (!data) {
    return <div className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: "var(--r-lg)" }} />)}</div>;
  }

  const subs = data.subscribers || [];
  return (
    <div className="space-y-3">
      <p className="font-work text-xs" style={{ color: "var(--text-secondary)" }}>
        Your reply commitment: within {data.sla_hours}h. Overdue threads are marked.
      </p>

      {subs.length === 0 && (
        <div className="card-base p-6 text-center">
          <Users size={20} className="mx-auto mb-2" style={{ color: "var(--accent)" }} />
          <p className="font-work text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No subscribers yet.</p>
          <p className="font-work text-xs" style={{ color: "var(--text-secondary)" }}>
            Finish your Get Discoverable checklist and your storefront opens for business.
          </p>
        </div>
      )}

      {subs.map(s => (
        <button key={s.athlete_id} onClick={() => setActive(s)}
          className="card-tappable w-full p-3 flex items-center gap-3 text-left">
          <img src={s.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: "1px solid var(--border-strong)", background: "var(--surface-2)" }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="font-work text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{s.display_name}</p>
              {s.is_minor && (
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded font-elite text-[8px] uppercase tracking-wide flex-shrink-0"
                  style={{ background: "var(--accent-subtle)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
                  {s.guardian_verified ? <ShieldCheck size={8} /> : <ShieldAlert size={8} />} Minor
                </span>
              )}
            </div>
            <p className="font-work text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Member since {new Date(s.since).toLocaleDateString()}
              {s.is_minor && (s.guardian_verified ? " · Guardian linked — messages logged & visible" : " · Awaiting guardian verification")}
            </p>
          </div>
          {s.overdue ? (
            <span className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-wide flex-shrink-0" style={{ color: "var(--warning)" }}>
              <Clock size={10} /> Reply overdue
            </span>
          ) : s.awaiting_reply ? (
            <span className="font-elite text-[9px] uppercase tracking-wide flex-shrink-0" style={{ color: "var(--text-secondary)" }}>Awaiting reply</span>
          ) : null}
        </button>
      ))}

      <CoachChatSheet
        open={!!active}
        onClose={() => setActive(null)}
        me={athlete}
        other={active ? { id: active.athlete_id, display_name: active.display_name, avatar_url: active.avatar_url } : null}
      />
    </div>
  );
}