// Coach-side inbox: conversations with subscribed athletes, grouped by athlete.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Inbox } from "lucide-react";
import CoachChatSheet from "@/components/messaging/CoachChatSheet";

export default function CoachInbox({ athlete }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeOther, setActiveOther] = useState(null);

  useEffect(() => {
    if (!athlete?.id) return;
    (async () => {
      const [received, sent] = await Promise.all([
        base44.entities.Message.filter({ recipient_athlete_id: athlete.id }, "-created_date", 200),
        base44.entities.Message.filter({ sender_athlete_id: athlete.id }, "-created_date", 200),
      ]);
      const byOther = {};
      [...received, ...sent].forEach(m => {
        const otherId = m.sender_athlete_id === athlete.id ? m.recipient_athlete_id : m.sender_athlete_id;
        if (!byOther[otherId] || new Date(m.created_date) > new Date(byOther[otherId].created_date)) byOther[otherId] = m;
      });
      const ids = Object.keys(byOther);
      const others = await Promise.all(ids.map(id => base44.entities.Athlete.get(id).catch(() => null)));
      setThreads(ids
        .map((id, i) => ({ other: others[i], last: byOther[id] }))
        .filter(t => t.other)
        .sort((a, b) => new Date(b.last.created_date) - new Date(a.last.created_date)));
      setLoading(false);
    })();
  }, [athlete?.id]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <Inbox size={14} style={{ color: 'var(--accent)' }} />
        <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Messages from Subscribers</p>
      </div>
      {loading ? (
        <div className="p-4 space-y-2">
          {[0, 1].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
        </div>
      ) : threads.length === 0 ? (
        <p className="font-work text-xs px-4 py-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          No messages yet — subscribers can message you directly once they join your coaching plan.
        </p>
      ) : (
        threads.map(({ other, last }) => (
          <button key={other.id} onClick={() => setActiveOther(other)}
            className="w-full flex items-center gap-3 px-4 py-3 border-t text-left"
            style={{ borderColor: 'var(--border-subtle)' }}>
            <img src={other.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border-strong)' }} />
            <div className="min-w-0 flex-1">
              <p className="font-work text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{other.display_name}</p>
              <p className="font-work text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                {last.sender_athlete_id === athlete.id ? "You: " : ""}{last.text}
              </p>
            </div>
          </button>
        ))
      )}
      <CoachChatSheet open={!!activeOther} onClose={() => setActiveOther(null)} me={athlete} other={activeOther} />
    </div>
  );
}