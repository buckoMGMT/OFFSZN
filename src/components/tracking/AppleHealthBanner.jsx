// Apple Health — honest forward-looking stub. Real HealthKit sync ships with
// the native iOS app; no fake connect flow, no dead tap.
import { useState } from "react";
import { Heart, CheckCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const INTEREST_KEY = "pb_health_interest";

// Android users get Health Connect; everyone else gets Apple Health.
const IS_ANDROID = typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
const SERVICE_NAME = IS_ANDROID ? "Health Connect" : "Apple Health";
const APP_LABEL = IS_ANDROID ? "Android" : "iOS";

export default function AppleHealthBanner() {
  const [dismissed, setDismissed] = useState(false);
  const [interested, setInterested] = useState(() => localStorage.getItem(INTEREST_KEY) === "yes");
  const [saving, setSaving] = useState(false);

  if (dismissed) return null;

  const notifyMe = async () => {
    setSaving(true);
    await base44.entities.Feedback.create({ category: "idea", message: IS_ANDROID ? "wants: android_health_connect" : "wants: apple_health", page: "Track" });
    localStorage.setItem(INTEREST_KEY, "yes");
    setInterested(true);
    setSaving(false);
  };

  return (
    <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
          <Heart size={17} style={{ color: 'var(--accent)' }} fill="var(--accent)" />
        </div>
        <div className="flex-1">
          <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>{SERVICE_NAME}</p>
          <p className="font-work text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            Sync is coming with the OFFSZN {APP_LABEL} app. Log manually for now — it all counts.
          </p>
        </div>
        <button onClick={() => setDismissed(true)} className="font-elite text-xs" style={{ color: 'var(--text-tertiary)' }}>✕</button>
      </div>
      <div className="px-4 pb-3">
        {interested ? (
          <p className="flex items-center gap-1.5 font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--positive)' }}>
            <CheckCircle size={12} /> You're on the list — we'll let you know
          </p>
        ) : (
          <button onClick={notifyMe} disabled={saving} className="btn-secondary w-full">
            {saving ? "Saving…" : "Notify Me When It Drops"}
          </button>
        )}
      </div>
    </div>
  );
}