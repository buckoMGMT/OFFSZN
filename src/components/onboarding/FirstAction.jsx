// Survey + FIRST ACTION beats survey alone. Do not end on an empty feed:
// log today's weight → DailyLog → streak = 1 → confetti → into the app.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { base44 } from "@/api/base44Client";
import { track } from "@/lib/analytics";
import { PrimaryButton, SkipButton, Field } from "@/components/onboarding/OnboardingUI";

export default function FirstAction({ athlete }) {
  const navigate = useNavigate();
  const [weight, setWeight] = useState(athlete?.weight_lbs || "");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const logIt = async () => {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    await base44.entities.DailyLog.create({
      athlete_id: athlete.id, date: today,
      weight_lbs: parseFloat(weight) || undefined, streak_day: true,
    });
    await base44.entities.Athlete.update(athlete.id, {
      current_streak_days: 1,
      ...(parseFloat(weight) ? { weight_lbs: parseFloat(weight) } : {}),
    });
    track.firstDailyLog(); // activation event — this IS their first-ever log
    track.dailyLogCompleted({ streak_day: true });
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.7 } });
    setDone(true);
    setSaving(false);
  };

  if (done) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center px-5 text-center">
        <h1 className="font-display text-4xl text-tx-primary mb-2">SZN STARTED.</h1>
        <p className="text-lg mb-8" style={{ color: "var(--accent)" }}>Day 1.</p>
        <div className="w-full" style={{ maxWidth: 420 }}>
          <PrimaryButton onClick={() => navigate("/", { replace: true })}>Take the field</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 px-5 pt-6 pb-8" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <span className="eyebrow" style={{ color: "var(--accent)" }}>One last thing</span>
      <h1 className="font-display text-2xl text-tx-primary mt-2 mb-2">START YOUR STREAK.</h1>
      <p className="text-tx-secondary text-sm mb-6">Log today's weight — one tap and Day 1 is on the books.</p>
      <Field label="Today's weight (lbs)" type="number" inputMode="decimal" min={50} max={500}
             value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus />
      <div className="mt-auto flex flex-col gap-2">
        <PrimaryButton onClick={logIt} disabled={!weight || saving}>
          {saving ? "Logging…" : "Log it — start Day 1"}
        </PrimaryButton>
        <SkipButton onClick={() => navigate("/", { replace: true })} children="Skip — take me in" />
      </div>
    </div>
  );
}