// Gate states for the 1-on-1 channel (§0). Teammate tone, never a bouncer —
// every gate reads as the next step, not a wall. No --negative styling here:
// these are steps, not failures.
import { ShieldCheck, ShieldAlert, Eye, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export function GuardianVisibilityBanner({ guardianName, coachSide }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border-subtle)' }}>
      <Eye size={12} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <p className="font-work text-[11px]" style={{ color: 'var(--text-primary)' }}>
        {coachSide
          ? "This athlete is a minor. This conversation is logged and visible to their guardian."
          : `This chat is visible to your parent/guardian ${guardianName} and is monitored for safety.`}
      </p>
    </div>
  );
}

const COPY = {
  needs_guardian: {
    icon: ShieldCheck,
    title: "One quick step",
    body: "A parent or guardian needs to approve messaging with coaches — it keeps you safe, and every message stays visible to them. It only takes a couple of minutes to set up. Here's how:",
    cta: { to: "/profile", label: "Set Up Guardian Approval" },
  },
  trial_expired: {
    icon: Clock,
    title: "Your 7-day pass ended",
    body: "Hope the week was worth it. Join the monthly coaching service to keep your direct line open — your coach is ready when you are.",
  },
  coach_not_verified: {
    icon: ShieldAlert,
    title: "Coach verification in progress",
    body: "This coach hasn't completed identity verification yet. Messaging opens once they're verified — your subscription and their drills are unaffected.",
  },
  no_subscription: {
    icon: ShieldAlert,
    title: "Members only",
    body: "1-on-1 messaging is part of this coach's paid coaching service. Join their plan — or grab a 7-day pass if they offer one — to open a direct line.",
  },
  no_channel: {
    icon: ShieldAlert,
    title: "Messaging isn't available here",
    body: "Direct messages only exist between a verified coach and their subscribed athletes.",
  },
  error: {
    icon: ShieldAlert,
    title: "Couldn't open messages",
    body: "Something went wrong checking this conversation. Close and try again.",
  },
};

export default function DmGate({ reason }) {
  const { icon: Icon, title, body, cta } = COPY[reason] || COPY.error;
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="p-3 rounded-full mb-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
        <Icon size={22} style={{ color: 'var(--accent)' }} />
      </div>
      <p className="font-work text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      {cta && (
        <Link to={cta.to} className="btn-stamp mt-4" style={{ minHeight: 40 }}>{cta.label}</Link>
      )}
    </div>
  );
}