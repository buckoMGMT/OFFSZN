// Settings row: pick any accent color from the native color wheel. Defaults to Cone Orange.
import { useState } from "react";
import { Palette, RotateCcw } from "lucide-react";
import { applyAccent, resetAccent, DEFAULT_ACCENT } from "@/lib/accentColor";

export default function AccentColorPicker() {
  const [color, setColor] = useState(() => localStorage.getItem('pb_accent') || DEFAULT_ACCENT);

  const pick = (hex) => { setColor(hex); applyAccent(hex); };
  const reset = () => { setColor(DEFAULT_ACCENT); resetAccent(); };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
      <div className="flex items-center gap-3">
        <Palette size={15} style={{ color: 'var(--accent)' }} />
        <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Accent Color</span>
      </div>
      <div className="flex items-center gap-2">
        {color.toUpperCase() !== DEFAULT_ACCENT && (
          <button onClick={reset} className="p-1.5 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }} title="Reset to Cone Orange">
            <RotateCcw size={12} style={{ color: 'var(--text-secondary)' }} />
          </button>
        )}
        <label className="relative w-9 h-9 rounded-full cursor-pointer overflow-hidden" style={{ border: '2px solid var(--border-strong)', background: color }}>
          <input
            type="color"
            value={color}
            onChange={e => pick(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            style={{ width: '100%', height: '100%' }}
          />
        </label>
      </div>
    </div>
  );
}