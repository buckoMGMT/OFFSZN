// The payoff screen: 1.5s intentional "BUILDING YOUR OFFSZN…" then the reveal —
// personalized numbers + 3 drills matched to sport/equipment/season.
// The answers must visibly shape what they see.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import BrandMark from "@/components/BrandMark";
import { PrimaryButton } from "@/components/onboarding/OnboardingUI";

export default function BuildMoment({ targets, isMinor, sport, trainingDays, onDone }) {
  const [phase, setPhase] = useState("building");
  const [drills, setDrills] = useState([]);

  useEffect(() => {
    const t = setTimeout(() => setPhase("reveal"), 1500);
    base44.entities.StretchProgram.list("-created_date", 30).then((all) => {
      const matched = all.filter((p) => p.sport === sport);
      setDrills((matched.length >= 3 ? matched : [...matched, ...all.filter((p) => p.sport !== sport)]).slice(0, 3));
    }).catch(() => {});
    return () => clearTimeout(t);
  }, [sport]);

  if (phase === "building") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <BrandMark size="lg" />
        <p className="font-display text-lg text-tx-primary">BUILDING YOUR OFFSZN…</p>
        <div className="skeleton" style={{ width: 140, height: 4, borderRadius: "var(--r-full)" }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 px-5 pb-8" style={{ maxWidth: 480, margin: "0 auto", width: "100%", paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
      <span className="eyebrow" style={{ color: "var(--accent)" }}>Built for you</span>
      <h1 className="font-display text-2xl text-tx-primary mt-2 mb-4">YOUR NUMBERS.</h1>

      {targets ? (
        <div className="rounded-lg border p-4 mb-4" style={{ background: "var(--surface-1)", borderColor: "var(--accent)" }}>
          <p className="stat-number text-4xl mb-1">{targets.goal_calories.toLocaleString()} <span className="text-base">cal</span></p>
          <p className="text-tx-secondary text-sm tabular-nums">
            {targets.goal_protein_g}g protein · {targets.goal_fats_g}g fat · {targets.goal_carbs_g}g carbs
          </p>
          <p className="text-xs text-tx-tertiary mt-2">
            {isMinor
              ? "Built to fuel growth and performance. You're still growing — we fuel the work, training does the rest."
              : `Based on your height, weight, age, sex, and ${trainingDays} training days a week.`}
            {targets.estimate ? " (estimate)" : ""}
          </p>
          {targets.clamped && (
            <p className="text-xs mt-2" style={{ color: "var(--warning)" }}>
              These numbers look low. Talk to a coach, parent, or doctor before changing how you eat.
            </p>
          )}
        </div>
      ) : (
        <p className="text-tx-secondary text-sm mb-4">Add your weight and height in Goals anytime to get your fueling targets.</p>
      )}

      {drills.length > 0 && (
        <>
          <p className="eyebrow mb-2">Your first drills</p>
          <div className="space-y-2 mb-4">
            {drills.map((d) => (
              <div key={d.id} className="rounded-md border px-4 py-3" style={{ background: "var(--surface-1)", borderColor: "var(--border-subtle)" }}>
                <p className="text-sm font-medium text-tx-primary">{d.title}</p>
                <p className="text-xs text-tx-tertiary">{[d.sport, d.difficulty, d.duration_minutes && `${d.duration_minutes}m`].filter(Boolean).join(" · ")}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-tx-tertiary mb-6">Adjust anything anytime in Goals.</p>
      <div className="mt-auto"><PrimaryButton onClick={onDone}>Continue</PrimaryButton></div>
    </div>
  );
}