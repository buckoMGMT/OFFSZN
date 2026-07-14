// GET DISCOVERABLE — the coach's persistent progress checklist.
import { CheckCircle2, Circle } from "lucide-react";
import { coachChecklist } from "@/lib/coachGate";

export default function CoachChecklist({ athlete }) {
  const items = coachChecklist(athlete);
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--surface-1)", borderColor: "var(--border-subtle)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="font-display text-sm text-tx-primary">GET DISCOVERABLE</p>
        <span className="eyebrow tabular-nums">{doneCount}/{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-2">
            {i.done
              ? <CheckCircle2 size={15} style={{ color: "var(--positive)" }} />
              : <Circle size={15} style={{ color: "var(--text-tertiary)" }} />}
            <span className="text-sm" style={{ color: i.done ? "var(--text-primary)" : "var(--text-secondary)" }}>{i.label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-tx-tertiary mt-3">
        Your profile stays private until all five are done — then athletes can find and subscribe to you in Drills.
      </p>
    </div>
  );
}