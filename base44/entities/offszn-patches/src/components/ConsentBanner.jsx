// Show once until answered. Analytics only initializes after Accept.
import { useState } from "react";
import { grantAnalyticsConsent, declineAnalyticsConsent, consentAnswered } from "@/lib/analytics";

export default function ConsentBanner() {
  const [gone, setGone] = useState(consentAnswered());
  if (gone) return null;
  return (
    <div className="fixed z-50 left-0 right-0 p-4" style={{ bottom: 0, background: "var(--surface-3)", borderTop: "1px solid var(--border-strong)" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
          We use privacy-safe analytics to see what's working and fix what isn't. No selling data, ever.
        </p>
        <div className="flex gap-3">
          <button onClick={() => { grantAnalyticsConsent(); setGone(true); }}
            className="flex-1 rounded-md font-semibold" style={{ height: 44, background: "var(--accent)", color: "var(--on-accent)" }}>OK</button>
          <button onClick={() => { declineAnalyticsConsent(); setGone(true); }}
            className="flex-1 rounded-md font-semibold" style={{ height: 44, background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border-strong)" }}>No thanks</button>
        </div>
      </div>
    </div>
  );
}
