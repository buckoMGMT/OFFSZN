// §2 — Sleep stepper: 0–14h in 30-min increments. Writes DailyLog.sleep_hours
// for today; editable; reflected in stats immediately via onSave.
import { Moon, Minus, Plus } from "lucide-react";

export default function SleepLogger({ hours, onSave }) {
  const value = hours || 0;
  const step = (delta) => {
    const next = Math.min(14, Math.max(0, Math.round((value + delta) * 2) / 2));
    onSave(next);
  };
  return (
    <div className="card-base p-4">
      <div className="flex items-center gap-2 mb-3">
        <Moon size={16} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
        <span className="eyebrow">Sleep</span>
        <span className="ml-auto" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>0–14h · 30-min steps</span>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={() => step(-0.5)} disabled={value <= 0}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', opacity: value <= 0 ? 0.4 : 1 }}>
          <Minus size={18} />
        </button>
        <div className="text-center">
          <p className="stat-number" style={{ fontSize: 'var(--text-4xl)', color: value > 0 ? 'var(--accent)' : 'var(--text-tertiary)' }}>
            {value % 1 === 0 ? value : value.toFixed(1)}
          </p>
          <p className="eyebrow mt-1">hours</p>
        </div>
        <button onClick={() => step(0.5)} disabled={value >= 14}
          className="w-11 h-11 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)', opacity: value >= 14 ? 0.4 : 1 }}>
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}