// One shared countdown — work intervals and rest periods both use it.
import { useState, useEffect } from "react";
import { Play, Pause, SkipForward } from "lucide-react";

export default function Countdown({ seconds, autoStart = false, onDone, label }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) { onDone?.(); return; }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [running, remaining]); // eslint-disable-line react-hooks/exhaustive-deps

  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = String(Math.max(0, remaining) % 60).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="eyebrow text-center">{label}</p>}
      <p className="stat-number tabular-nums" style={{ fontSize: 'var(--text-hero)' }}>{mm}:{ss}</p>
      <div className="flex gap-3">
        <button onClick={() => setRunning(r => !r)} className="btn-secondary" style={{ minWidth: 110 }}>
          {running ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Start</>}
        </button>
        <button onClick={() => onDone?.()} className="btn-secondary">
          <SkipForward size={13} /> Skip
        </button>
      </div>
    </div>
  );
}