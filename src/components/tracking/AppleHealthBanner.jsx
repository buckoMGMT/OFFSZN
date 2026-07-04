import { useState, useEffect } from "react";
import { Heart, CheckCircle, Activity, Moon, Zap } from "lucide-react";

// Footprints icon inline — not in lucide-react v0.475
function Footprints({ size = 14, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9 2 9 5.5 9 8s-1 3-1 5v1" />
      <path d="M4 22h1" />
      <path d="M9 22h1" />
      <path d="M20 16v-2.38C20 11.5 21.03 10.5 21 8c-.03-2.72-1.49-6-4.5-6C15 2 15 5.5 15 8s1 3 1 5v1" />
      <path d="M20 22h1" />
      <path d="M15 22h1" />
    </svg>
  );
}

// Simulates reading from HealthKit. In a real iOS native wrapper (Capacitor/React Native),
// these values would come from HealthKit.getQuantitySamples(). Here we generate realistic
// values so the UI/UX flow is fully functional for the web preview.
function generateHealthData() {
  const steps = Math.floor(6200 + Math.random() * 5800);
  const sleep = parseFloat((6.5 + Math.random() * 2.5).toFixed(1));
  const activeCalories = Math.floor(280 + Math.random() * 420);
  const hrv = Math.floor(38 + Math.random() * 30);
  return { steps, sleep_hours: sleep, active_calories: activeCalories, hrv };
}

export default function AppleHealthBanner({ log, onSync }) {
  const [status, setStatus] = useState("idle"); // idle | connecting | synced
  const [healthData, setHealthData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  // Auto-attempt sync on mount (simulates background refresh)
  useEffect(() => {
    const alreadySynced = sessionStorage.getItem("health_synced_today");
    if (alreadySynced) {
      const data = JSON.parse(alreadySynced);
      setHealthData(data);
      setStatus("synced");
    }
  }, []);

  if (dismissed) return null;

  const handleSync = async () => {
    setStatus("connecting");
    // Simulate HealthKit handshake + data pull
    await new Promise(r => setTimeout(r, 400));
    const data = generateHealthData();
    await new Promise(r => setTimeout(r, 800));
    setHealthData(data);
    setStatus("synced");
    sessionStorage.setItem("health_synced_today", JSON.stringify(data));
    // Push to DailyLog
    onSync?.({
      sleep_hours: data.sleep_hours,
      workout_complete: data.active_calories > 400,
    });
  };

  const metrics = healthData ? [
    { icon: Footprints, label: "Steps", value: healthData.steps.toLocaleString(), color: "var(--text-secondary)" },
    { icon: Moon, label: "Sleep", value: `${healthData.sleep_hours}h`, color: "var(--text-secondary)" },
    { icon: Zap, label: "Active Cal", value: healthData.active_calories.toLocaleString(), color: "var(--accent)" },
    { icon: Activity, label: "HRV", value: healthData.hrv, color: "var(--text-secondary)" },
  ] : [];

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
          <Heart size={17} style={{ color: 'var(--accent)' }} fill="var(--accent)" />
        </div>
        <div className="flex-1">
          <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Apple Health</p>
          <p className="font-work text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            {status === "synced" ? "Synced — steps, sleep & active cals imported" : "Connect to auto-log steps, sleep & calories"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status !== "synced" && (
            <button onClick={handleSync} disabled={status === "connecting"}
              className="btn-stamp flex items-center gap-1.5 disabled:opacity-60">
              {status === "connecting"
                ? <><div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />Syncing</>
                : <><Heart size={10} fill="currentColor" />Connect</>
              }
            </button>
          )}
          {status === "synced" && (
            <div className="flex items-center gap-1 font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              <CheckCircle size={11} /> Live
            </div>
          )}
          <button onClick={() => setDismissed(true)} className="font-elite text-xs" style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
      </div>

      {/* Synced metric grid */}
      {status === "synced" && healthData && (
        <div className="grid grid-cols-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {metrics.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center py-3 gap-1" style={{ borderRight: '1px solid var(--border-subtle)' }}>
              <Icon size={13} style={{ color }} />
              <p className="font-elite text-sm leading-none" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="font-elite text-[7px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {status === "connecting" && (
        <div className="px-4 pb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div className="h-full animate-pulse" style={{ width: '60%', background: 'var(--accent)' }} />
          </div>
          <p className="font-elite text-[9px] uppercase tracking-widest mt-1.5" style={{ color: 'var(--text-tertiary)' }}>Requesting HealthKit permissions…</p>
        </div>
      )}

      {status === "idle" && (
        <div className="px-4 pb-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="font-work text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            Full sync in the iOS app · HRV, sleep stages & active calories
          </p>
        </div>
      )}
    </div>
  );
}