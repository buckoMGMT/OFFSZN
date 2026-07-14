// Coach settings: pick which 1-on-1 coaching services the subscription includes.
// Messaging is locked on; the rest are optional but encouraged. Additive only —
// no existing feature is gated behind these toggles.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SERVICE_META, normalizeServices } from "@/components/playbook/ServicesIncludedList";

const OPTIONAL = [
  { key: "form_checks", sub: "Encouraged: coaches offering form checks convert more subscribers" },
  { key: "weekly_programming" },
  { key: "progress_checkins" },
];
const SLA_OPTIONS = [24, 48, 72];

export default function CoachServiceEditor({ athlete, onUpdate }) {
  const [services, setServices] = useState(() => normalizeServices(athlete?.coach_services));
  const [sla, setSla] = useState(athlete?.coach_response_sla_hours || 48);

  const persist = async (nextServices, nextSla) => {
    await base44.entities.Athlete.update(athlete.id, {
      coach_services: nextServices,
      coach_response_sla_hours: nextSla,
    });
    onUpdate?.({ ...athlete, coach_services: nextServices, coach_response_sla_hours: nextSla });
  };

  const toggle = (key, on) => {
    const next = on ? [...services, key] : services.filter(s => s !== key);
    setServices(next);
    persist(next, sla);
  };

  const pickSla = (h) => {
    setSla(h);
    persist(services, h);
  };

  return (
    <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
      <p className="eyebrow mb-1">Your subscription includes</p>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
        OFFSZN subscriptions are 1-on-1 coaching services. Pick what yours includes — athletes see this before they subscribe.
      </p>

      {/* Messaging — always on */}
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {SERVICE_META.messaging.label}
          </p>
          <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Included in every subscription</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={11} style={{ color: 'var(--text-tertiary)' }} />
          <Switch checked disabled />
        </div>
      </div>

      {OPTIONAL.map(({ key, sub }) => (
        <div key={key} className="flex items-center justify-between py-2 gap-3">
          <div className="min-w-0">
            <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {SERVICE_META[key].label}
            </p>
            {sub && <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{sub}</p>}
          </div>
          <Switch checked={services.includes(key)} onCheckedChange={on => toggle(key, on)} />
        </div>
      ))}

      <div className="mt-2">
        <p className="text-[10px] mb-1.5 font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          Response time commitment
        </p>
        <div className="flex gap-2">
          {SLA_OPTIONS.map(h => (
            <button key={h} onClick={() => pickSla(h)}
              className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
              style={sla === h
                ? { background: 'var(--accent)', color: 'var(--on-accent)', border: 'none' }
                : { background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
              {h}h
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}