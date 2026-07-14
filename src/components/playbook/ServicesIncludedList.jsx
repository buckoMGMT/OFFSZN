// "WHAT'S INCLUDED" list for a coach's 1-on-1 coaching service subscription.
// Messaging is always present — the list is never empty.
import { MessageCircle, Video, CalendarRange, ClipboardCheck, Clock } from "lucide-react";

export const SERVICE_META = {
  messaging: { label: "Direct 1-on-1 messaging", icon: MessageCircle },
  form_checks: { label: "Form-check video reviews", icon: Video },
  weekly_programming: { label: "Weekly programming", icon: CalendarRange },
  progress_checkins: { label: "Monthly progress check-ins", icon: ClipboardCheck },
};

export function normalizeServices(list) {
  const s = (Array.isArray(list) ? list : []).filter(k => SERVICE_META[k]);
  return s.includes("messaging") ? s : ["messaging", ...s];
}

export default function ServicesIncludedList({ services, slaHours = 48 }) {
  const keys = normalizeServices(services);
  return (
    <div className="mb-3">
      <p className="font-elite text-[9px] uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
        What's Included
      </p>
      <div className="space-y-1.5">
        {keys.map(k => {
          const Icon = SERVICE_META[k].icon;
          return (
            <div key={k} className="flex items-center gap-2">
              <Icon size={13} style={{ color: 'var(--accent)' }} />
              <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{SERVICE_META[k].label}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2">
          <Clock size={13} style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Replies within {slaHours || 48}h</span>
        </div>
      </div>
    </div>
  );
}