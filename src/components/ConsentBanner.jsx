// Analytics consent — opt-in only. No events fire until "Allow" is tapped.
import { useState } from "react";

const KEY = "offszn_analytics_consent";

export default function ConsentBanner() {
  const [answered, setAnswered] = useState(() => localStorage.getItem(KEY) !== null);
  if (answered) return null;

  const choose = (value) => {
    localStorage.setItem(KEY, value);
    setAnswered(true);
  };

  return (
    <div
      className="fixed left-0 right-0 z-[90] px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}
    >
      <div
        className="mx-auto rounded-xl border p-4 overlay-shadow"
        style={{ maxWidth: 440, background: "var(--surface-2)", borderColor: "var(--border-strong)" }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Help us improve OFFSZN?
        </p>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "var(--text-secondary)" }}>
          We'd like to collect anonymous usage stats (no name, email, or birthday — ever) to make the app better. Your call.
        </p>
        <div className="flex gap-2">
          <button onClick={() => choose("off")} className="flex-1 btn-secondary" style={{ minHeight: 40 }}>
            No thanks
          </button>
          <button onClick={() => choose("on")} className="flex-1 btn-stamp" style={{ minHeight: 40 }}>
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}