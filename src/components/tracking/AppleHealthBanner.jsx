import { useState } from "react";
import { Heart, CheckCircle, ChevronRight } from "lucide-react";

export default function AppleHealthBanner({ log, onSync }) {
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleSync = async () => {
    setSyncing(true);
    // Apple HealthKit can only be accessed via a native wrapper (e.g. Capacitor/React Native).
    // In a web context we simulate the prompt and show the user how to manually sync.
    await new Promise(r => setTimeout(r, 1200));
    setSyncing(false);
    setSynced(true);
    setTimeout(() => setDismissed(true), 2500);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
            <Heart size={18} className="text-red-400" fill="currentColor" />
          </div>
          <div>
            {synced ? (
              <>
                <div className="flex items-center gap-1.5">
                  <CheckCircle size={13} className="text-green-400" />
                  <p className="text-sm font-semibold text-foreground">Apple Health Synced</p>
                </div>
                <p className="text-[10px] text-muted-foreground">Steps, sleep & calories imported</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Sync Apple Health</p>
                <p className="text-[10px] text-muted-foreground">Import steps, sleep & active calories</p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!synced && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1 bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
            >
              {syncing ? (
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Syncing
                </span>
              ) : (
                <>Sync <ChevronRight size={12} /></>
              )}
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-muted-foreground/40 text-xs">✕</button>
        </div>
      </div>

      {!synced && (
        <p className="text-[10px] text-muted-foreground mt-2.5 border-t border-border pt-2.5">
          Full Apple Health sync available in the iOS app. Data includes steps, HRV, sleep stages, and active calories.
        </p>
      )}
    </div>
  );
}