// Gate states for the 1-on-1 channel (§0). Never a dead error — the guardian
// path is always shown as the next step, not a wall.
import { ShieldCheck, ShieldAlert, Eye } from "lucide-react";

export function GuardianVisibilityBanner({ name }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ background: 'var(--accent-subtle)', borderColor: 'var(--border-subtle)' }}>
      <Eye size={12} className="flex-shrink-0" style={{ color: 'var(--accent)' }} />
      <p className="font-work text-[11px]" style={{ color: 'var(--text-primary)' }}>
        This conversation is logged and visible to {name ? `${name}'s` : "the athlete's"} guardian.
      </p>
    </div>
  );
}

const COPY = {
  needs_guardian: {
    icon: ShieldCheck,
    title: "Guardian approval needed",
    body: "1-on-1 coaching messages for athletes under 18 open once a parent or guardian verifies their account. Add your guardian from Player → Account to unlock this — every message is logged and visible to them.",
  },
  coach_not_verified: {
    icon: ShieldAlert,
    title: "Coach verification in progress",
    body: "This coach hasn't completed identity verification yet. Messaging opens once they're verified — your subscription and their drills are unaffected.",
  },
  no_subscription: {
    icon: ShieldAlert,
    title: "Members only",
    body: "1-on-1 messaging is part of this coach's paid coaching service. Join their plan to open a direct line.",
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
  const { icon: Icon, title, body } = COPY[reason] || COPY.error;
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="p-3 rounded-full mb-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)' }}>
        <Icon size={22} style={{ color: 'var(--accent)' }} />
      </div>
      <p className="font-work text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>
      <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
    </div>
  );
}