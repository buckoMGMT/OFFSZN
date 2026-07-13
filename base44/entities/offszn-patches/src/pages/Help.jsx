// src/pages/Help.jsx — route at /help, link from Player page settings.
import { useState } from "react";

const FAQS = [
  ["What does the All-SZN Pass include?", "The full premium drill library, posting to The Field, advanced stats (NCAA benchmarks + percentiles), custom playlists, team creation, and the path to verified Coach status. $9.99/mo, cancel anytime in settings. Coach subscriptions are separate — each coach sets their own monthly rate."],
  ["How do coach subscriptions work?", "Subscribing to a coach unlocks their drill library, 1-on-1 messaging, and personalized feedback for a monthly price the coach sets. Athletes under 18 need a verified parent/guardian to subscribe."],
  ["How do I earn and redeem points?", "Log workouts, keep your streak, complete challenges. Real-world rewards (merch, gift cards) unlock after 90 days on OFFSZN with consistent training — the grind is the price."],
  ["Why does my account need a guardian?", "Athletes under 18 can train from day one. A verified parent/guardian is required only for spending money and public competition. It retires automatically at 18."],
  ["How do I cancel the All-SZN Pass?", "Settings → Subscription → Cancel. Access runs through the end of the paid period. No hoops."],
];

export default function Help() {
  const [open, setOpen] = useState(null);
  return (
    <div className="min-h-screen px-5 py-6" style={{ background: "var(--surface-0)", maxWidth: 480, margin: "0 auto" }}>
      <h1 className="font-display text-2xl mb-6" style={{ color: "var(--text-primary)" }}>HELP</h1>
      {FAQS.map(([q, a], i) => (
        <div key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
          <button onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}
            className="w-full text-left py-4 font-semibold flex justify-between items-center"
            style={{ color: "var(--text-primary)" }}>
            {q}<span style={{ color: "var(--accent)" }}>{open === i ? "–" : "+"}</span>
          </button>
          {open === i && <p className="pb-4 text-sm" style={{ color: "var(--text-secondary)" }}>{a}</p>}
        </div>
      ))}
      <div className="mt-8 flex flex-col gap-3">
        <a href="mailto:support@offsznapp.com" className="font-semibold text-center rounded-md flex items-center justify-center"
           style={{ height: 52, background: "var(--accent)", color: "var(--on-accent)", textDecoration: "none" }}>
          Contact support
        </a>
        <a href="mailto:privacy@offsznapp.com?subject=Data%20request" className="text-center text-sm py-2"
           style={{ color: "var(--text-tertiary)", textDecoration: "none" }}>
          Request or delete my data
        </a>
      </div>
    </div>
  );
}
