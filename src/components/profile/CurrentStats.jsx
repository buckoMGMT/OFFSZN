// Current height + weight — editable, feeds straight into Recalculate Targets.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Ruler } from "lucide-react";

export default function CurrentStats({ athlete, onUpdate }) {
  const h = athlete?.height_inches || 0;
  const [feet, setFeet] = useState(h ? Math.floor(h / 12) : "");
  const [inches, setInches] = useState(h ? h % 12 : "");
  const [weight, setWeight] = useState(athlete?.weight_lbs || "");
  const [error, setError] = useState("");

  const save = async () => {
    const totalIn = (Number(feet) || 0) * 12 + (Number(inches) || 0);
    const w = Number(weight) || null;
    const data = { height_inches: totalIn > 0 ? totalIn : null, weight_lbs: w };
    if (data.height_inches === (athlete.height_inches || null) && data.weight_lbs === (athlete.weight_lbs || null)) return;
    setError("");
    try {
      const updated = await base44.entities.Athlete.update(athlete.id, data);
      onUpdate?.(updated);
    } catch {
      setError("Couldn't save — check your connection and try again.");
    }
  };

  const inputStyle = {
    background: 'var(--theme-bg)',
    border: '1px solid var(--theme-border)',
    color: 'var(--theme-ink)',
  };

  return (
    <div className="rounded border p-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
      <div className="flex items-center gap-2">
        <Ruler size={13} style={{ color: 'var(--accent)' }} />
        <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Current</p>
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--negative)' }}>{error}</p>}
      <div className="flex items-center justify-between">
        <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Height</span>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" min="0" max="8" placeholder="5"
            className="w-14 rounded px-2 py-1.5 font-elite text-sm outline-none text-right" style={inputStyle}
            value={feet} onChange={e => setFeet(e.target.value)} onBlur={save} />
          <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>ft</span>
          <input type="number" inputMode="numeric" min="0" max="11" placeholder="10"
            className="w-14 rounded px-2 py-1.5 font-elite text-sm outline-none text-right" style={inputStyle}
            value={inches} onChange={e => setInches(e.target.value === "" ? "" : Math.min(11, Number(e.target.value)))} onBlur={save} />
          <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>in</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Weight</span>
        <div className="flex items-center gap-2">
          <input type="number" inputMode="decimal" min="0" placeholder="0"
            className="w-24 rounded px-3 py-1.5 font-elite text-sm outline-none text-right" style={inputStyle}
            value={weight} onChange={e => setWeight(e.target.value)} onBlur={save} />
          <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>lbs</span>
        </div>
      </div>
      <p className="font-work text-[10px] leading-relaxed" style={{ color: 'var(--theme-ink-soft)' }}>
        These feed Recalculate Targets — keep them current and your macros stay honest.
      </p>
    </div>
  );
}