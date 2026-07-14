// Post-subscribe confirmation banner — shown once after returning from Stripe checkout.
import { useState, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";

export default function CoachSubSuccessToast() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("coach_sub") === "success") {
      setInfo({ name: p.get("coach_name") || "your coach", sla: p.get("coach_sla") || "48" });
      p.delete("coach_sub"); p.delete("coach_name"); p.delete("coach_sla");
      const qs = p.toString();
      window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
  }, []);

  if (!info) return null;

  return (
    <div className="fixed left-1/2 -translate-x-1/2 z-[120] w-[92%] max-w-md rounded-xl border p-4 flex items-start gap-3 animate-slide-up overlay-shadow"
      style={{ top: 'calc(12px + env(safe-area-inset-top))', background: 'var(--surface-1)', borderColor: 'var(--accent)' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-subtle)' }}>
        <MessageCircle size={15} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>You're in — 1-on-1 coaching active</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          You now have direct access to {info.name} — message anytime, replies within {info.sla}h.
        </p>
      </div>
      <button onClick={() => setInfo(null)} className="p-1 flex-shrink-0">
        <X size={14} style={{ color: 'var(--text-tertiary)' }} />
      </button>
    </div>
  );
}