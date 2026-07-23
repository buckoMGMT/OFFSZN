// 1-on-1 chat between an athlete and their coach — the "human service" layer.
// EVERY open runs a dmGuard check; EVERY send goes through dmGuard server-side
// (assertDmAllowed). There is no direct Message write path from the client.
import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { X, Send, BadgeCheck } from "lucide-react";
import DmGate, { GuardianVisibilityBanner } from "@/components/messaging/DmGate";
import useSheetBack from "@/lib/useSheetBack";

export default function CoachChatSheet({ open, onClose, me, other }) {
  const [gate, setGate] = useState(null); // null = checking
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const endRef = useRef(null);

  // §4 — back gesture / hardware back dismisses this sheet first
  useSheetBack(open, onClose);

  useEffect(() => {
    if (!open || !me?.id || !other?.id) return;
    setGate(null); setMessages([]); setSendError("");
    base44.functions.invoke("dmGuard", { action: "check", otherAthleteId: other.id })
      .then(r => setGate(r.data))
      .catch(() => setGate({ allowed: false, reason: "error" }));
  }, [open, me?.id, other?.id]);

  useEffect(() => {
    if (!open || !gate?.allowed || !me?.id || !other?.id) return;
    Promise.all([
      base44.entities.Message.filter({ sender_athlete_id: me.id, recipient_athlete_id: other.id }),
      base44.entities.Message.filter({ sender_athlete_id: other.id, recipient_athlete_id: me.id }),
    ]).then(([sent, received]) => {
      setMessages([...sent, ...received].sort((a, b) => new Date(a.created_date) - new Date(b.created_date)));
    });
    const unsubscribe = base44.entities.Message.subscribe((event) => {
      if (event.type !== "create") return;
      const m = event.data;
      const relevant =
        (m.sender_athlete_id === me.id && m.recipient_athlete_id === other.id) ||
        (m.sender_athlete_id === other.id && m.recipient_athlete_id === me.id);
      if (relevant) setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
    });
    return unsubscribe;
  }, [open, gate?.allowed, me?.id, other?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  if (!open || !me || !other) return null;

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setSendError("");
    try {
      const res = await base44.functions.invoke("dmGuard", { action: "send", otherAthleteId: other.id, text: t });
      const m = res.data?.message;
      if (m) setMessages(prev => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
      setText("");
    } catch (e) {
      const reason = e?.response?.data?.reason;
      if (reason) setGate({ allowed: false, reason }); // guard state changed mid-thread
      else setSendError("Message didn't send. Try again.");
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up flex flex-col"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', height: '80vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <img src={other.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" style={{ border: '1px solid var(--accent)' }} />
            <div>
              <div className="flex items-center gap-1">
                <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{other.display_name}</p>
                {other.is_coach_verified && <BadgeCheck size={13} style={{ color: 'var(--accent)' }} />}
              </div>
              <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Direct Message</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {gate === null ? (
          <div className="flex-1 p-4 space-y-2">
            {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : !gate.allowed || (gate.minor_involved && !gate.guardian_name && !gate.guardian_email) ? (
          /* Fail safe: a minor thread never opens without a nameable guardian */
          <DmGate reason={gate.allowed ? "needs_guardian" : gate.reason} />
        ) : (
          <>
            {/* §0/§5 — persistent, visible guardian-visibility banner on minor threads */}
            {gate.minor_involved && (
              <GuardianVisibilityBanner
                coachSide={me.role === "coach"}
                guardianName={gate.guardian_name || gate.guardian_email}
              />
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-xs text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                  Start the conversation — ask about form, programming, or goals.
                </p>
              )}
              {messages.map(m => {
                const mine = m.sender_athlete_id === me.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%] px-3 py-2 rounded-lg text-sm"
                      style={mine
                        ? { background: 'var(--accent)', color: 'var(--on-accent)', borderBottomRightRadius: 4 }
                        : { background: 'var(--surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderBottomLeftRadius: 4 }}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Composer */}
            {sendError && <p className="text-xs px-4 pb-1" style={{ color: 'var(--negative)' }}>{sendError}</p>}
            <div className="flex items-center gap-2 px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <input
                className="input-base"
                style={{ minHeight: 44, flex: 1 }}
                placeholder="Message..."
                value={text}
                maxLength={2000}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") send(); }}
              />
              <button onClick={send} disabled={!text.trim() || sending}
                className="flex-shrink-0 flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: 'var(--accent)', color: 'var(--on-accent)', opacity: !text.trim() || sending ? 0.45 : 1 }}>
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}