// Studio Payouts — [POST] stub. Connect status is real; balance/history land after launch.
import { Banknote, CheckCircle2, AlertCircle } from "lucide-react";

export default function StudioPayouts({ athlete }) {
  const connected = athlete.stripe_onboarding_status === "complete";
  return (
    <div className="space-y-3">
      <div className="card-base p-4">
        <div className="flex items-center gap-2 mb-2">
          <Banknote size={15} style={{ color: "var(--accent)" }} />
          <p className="font-work text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Payout Account</p>
        </div>
        {connected ? (
          <p className="flex items-center gap-1.5 font-work text-xs" style={{ color: "var(--positive)" }}>
            <CheckCircle2 size={12} /> Stripe payouts connected — earnings transfer automatically on Stripe's payout schedule.
          </p>
        ) : (
          <p className="flex items-center gap-1.5 font-work text-xs" style={{ color: "var(--warning)" }}>
            <AlertCircle size={12} /> Payouts not set up yet — finish Stripe onboarding in Player → Coach Tools.
          </p>
        )}
      </div>
      <div className="card-base p-6 text-center">
        <p className="font-work text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Coming soon — payout history</p>
        <p className="font-work text-xs" style={{ color: "var(--text-secondary)" }}>
          Balance, payout history, and next payout date will live here. Until then, Stripe emails you every payout.
        </p>
      </div>
    </div>
  );
}