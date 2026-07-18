// Help & Support — FAQ plus in-app feedback. Linked from Player → Settings.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import FeedbackForm from "@/components/help/FeedbackForm";

const FAQS = [
  {
    q: "How do I earn points?",
    a: "Log your meals, water, sleep, and workouts every day on the Stats tab. Daily activity earns points (capped at 300/day) that you can redeem in the Locker for merch and gift cards.",
  },
  {
    q: "What does the ALL-SZN Pass include?",
    a: "The Pass ($9.99/mo) unlocks premium programs, advanced stat analytics, and full access across the app. Coach 1-on-1 services are sold separately by each coach.",
  },
  {
    q: "How do coach subscriptions work?",
    a: "Verified coaches offer a monthly 1-on-1 service that includes direct messaging and personal feedback. If you're under 18, a verified parent or guardian must be linked to your account first.",
  },
  {
    q: "I'm under 18 — who can message me?",
    a: "Only a verified coach you're actively subscribed to, and only through monitored in-app messaging your linked guardian can see. No one else can open a private thread with you.",
  },
  {
    q: "How do I report something unsafe?",
    a: "Every post, comment, drill, and profile has a report option. Anything involving minor safety is escalated immediately and the content is hidden pending human review.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Go to Player → Settings → Manage Subscription to open the billing portal, where you can cancel anytime.",
  },
  {
    q: "How do I delete my account?",
    a: "Player → Settings → Delete Account. This permanently removes your profile and data.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-base overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold pr-3" style={{ color: "var(--text-primary)" }}>{q}</span>
        <ChevronDown size={16} style={{ color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>
      {open && (
        <p className="px-4 pb-4 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{a}</p>
      )}
    </div>
  );
}

export default function Help() {
  return (
    <div className="min-h-screen px-5 pb-10" style={{ background: "var(--surface-0)", maxWidth: 480, margin: "0 auto" }}>
      <h1 className="font-anton text-2xl uppercase pt-4 mb-1" style={{ color: "var(--text-primary)" }}>Help & Support</h1>
      <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
        Answers to common questions — or send us feedback directly.
      </p>

      <div className="space-y-2 mb-6">
        {FAQS.map((f) => <FaqItem key={f.q} {...f} />)}
      </div>

      <FeedbackForm />

      <p className="text-center text-xs mt-6">
        <Link to="/aup" className="underline" style={{ color: "var(--text-tertiary)" }}>Acceptable Use Policy</Link>
      </p>
    </div>
  );
}