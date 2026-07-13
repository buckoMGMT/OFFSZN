// Floating feedback button — mount once in AppLayout. Writes to the
// Feedback entity (created_by auto-stamps who sent it).
import { useState } from "react";
import { Feedback } from "@/api/entities";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState("bug");
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    if (!msg.trim()) return;
    try {
      await Feedback.create({ category: cat, message: msg.trim(), page: window.location.pathname });
      setSent(true); setTimeout(() => { setOpen(false); setSent(false); setMsg(""); }, 1500);
    } catch { /* fail quiet — feedback must never crash the app */ }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)} aria-label="Send feedback"
      className="fixed z-40 rounded-full font-semibold text-xs"
      style={{ bottom: 96, right: 16, height: 40, padding: "0 14px",
               background: "var(--surface-2)", color: "var(--text-secondary)",
               border: "1px solid var(--border-strong)" }}>
      Feedback
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setOpen(false)}>
      <div className="w-full p-5" style={{ background: "var(--surface-2)", borderRadius: "24px 24px 0 0", maxWidth: 480, margin: "0 auto" }}
           onClick={(e) => e.stopPropagation()}>
        {sent ? <p style={{ color: "var(--positive)", fontWeight: 600 }}>Got it. Thank you.</p> : (<>
          <p className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>What's up?</p>
          <div className="flex gap-2 mb-3">
            {["bug", "idea", "confusing"].map((c) => (
              <button key={c} onClick={() => setCat(c)} className="rounded-md text-sm px-3" style={{
                height: 36, background: cat === c ? "var(--accent-subtle)" : "var(--surface-1)",
                border: `1px solid ${cat === c ? "var(--accent)" : "var(--border-strong)"}`,
                color: cat === c ? "var(--accent)" : "var(--text-primary)" }}>{c}</button>
            ))}
          </div>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3} placeholder="Tell us straight…"
            className="w-full rounded-md p-3 text-sm mb-3"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border-strong)", color: "var(--text-primary)" }} />
          <button onClick={send} className="w-full rounded-md font-semibold"
            style={{ height: 48, background: "var(--accent)", color: "var(--on-accent)" }}>Send</button>
        </>)}
      </div>
    </div>
  );
}
