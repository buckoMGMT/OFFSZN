// Athlete onboarding path (§3): name → sport → season → goals → numbers →
// equipment → limitations → BUILD reveal → first action. ~90 seconds.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { computeTargets, ageFromDob } from "@/lib/macroEngine";
import { ProgressBar, StepShell, PrimaryButton, SkipButton, Chip, Field } from "@/components/onboarding/OnboardingUI";
import BuildMoment from "@/components/onboarding/BuildMoment";
import FirstAction from "@/components/onboarding/FirstAction";

const SPORTS = [
  ["football", "Football"], ["basketball", "Basketball"], ["baseball", "Baseball"],
  ["soccer", "Soccer"], ["track", "Track & Field"], ["volleyball", "Volleyball"],
  ["wrestling", "Wrestling"], ["swimming", "Swimming"], ["lacrosse", "Lacrosse"],
  ["tennis", "Tennis"], ["softball", "Softball"], ["cross_country", "Cross Country"],
  ["golf", "Golf"], ["other", "Other"],
];
const GRADES = [["freshman", "Freshman"], ["sophomore", "Sophomore"], ["junior", "Junior"], ["senior", "Senior"], ["college", "College"]];
const SEASONS = [["in_season", "In season"], ["pre_season", "Preseason"], ["off_season", "Off season — this is the OFFSZN. Let's build."]];
const EQUIPMENT = [["full_gym", "Full weight room"], ["home_gym", "Home setup"], ["bodyweight_only", "Bodyweight only"]];
const DAYS = [["1–2", 2], ["3", 3], ["4–5", 5], ["6", 6], ["7+", 7]];
const SEXES = [["male", "Male"], ["female", "Female"], ["unspecified", "Prefer not to say"]];

const TOTAL = 12; // account✓ + dob + role + 9 athlete steps

export default function AthletePath({ dob, isMinor }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [targets, setTargets] = useState(null);
  const [f, setF] = useState({
    display_name: "", sport: "", position: "", grade: "",
    season_status: "", goals: [],
    biological_sex: "", weight_lbs: "", height_ft: "", height_in: "", goal_weight_lbs: "",
    training_days: 5, equipment_access: "", has_limitations: null, limitations_note: "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const GOALS = [
    ["starting_spot", "Earn the starting spot"],
    ["gain_muscle", "Gain muscle"],
    isMinor ? ["make_weight", "Make weight for my class"] : ["cut_weight", "Cut weight"],
    ["get_faster", "Get faster"],
    ["recruiting", "Get recruited"],
    ["stay_ready", "Stay ready in the offseason"],
  ];

  const next = () => {
    base44.analytics.track({ eventName: "onboarding_step_completed", properties: { path: "athlete", step } });
    setError(null); setStep((s) => s + 1);
  };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  async function saveAndBuild() {
    setSaving(true); setError(null);
    try {
      const heightIn = (parseInt(f.height_ft || 0, 10) * 12) + parseInt(f.height_in || 0, 10);
      const t = computeTargets({
        weightLbs: f.weight_lbs, heightInches: heightIn, age: ageFromDob(dob),
        sex: f.biological_sex || "unspecified", trainingDays: f.training_days,
        goals: f.goals, isMinor,
      });
      const payload = {
        display_name: f.display_name.trim(),
        sport: f.sport || "other",
        position: f.position.trim() || undefined,
        grade: f.grade || undefined,
        season_status: f.season_status || "off_season",
        training_goals: f.goals,
        biological_sex: f.biological_sex || "unspecified",
        weight_lbs: parseFloat(f.weight_lbs) || undefined,
        height_inches: heightIn > 0 ? heightIn : undefined,
        // No goal-weight field for minors — never asked, never stored.
        goal_weight_lbs: !isMinor ? (parseFloat(f.goal_weight_lbs) || undefined) : undefined,
        training_days_per_week: f.training_days,
        equipment_access: f.equipment_access || "full_gym",
        has_limitations: !!f.has_limitations,
        limitations_note: f.has_limitations ? f.limitations_note.trim() || undefined : undefined,
        role: "athlete",
        onboarding_complete: true,
        ...(t || {}),
      };
      delete payload.estimate; delete payload.clamped;
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      const existing = await base44.entities.Athlete.list("-created_date", 1);
      const rec = existing?.length
        ? await base44.entities.Athlete.update(existing[0].id, payload)
        : await base44.entities.Athlete.create(payload);
      setAthlete(rec); setTargets(t);
      base44.analytics.track({ eventName: "onboarding_completed", properties: {
        role: "athlete", sport: payload.sport, season_status: payload.season_status,
        is_minor: !!isMinor, training_days: f.training_days,
      }});
      next();
    } catch {
      setError("Couldn't save your profile. Try again.");
    } finally { setSaving(false); }
  }

  if (step === 7) return <BuildMoment targets={targets} isMinor={isMinor} sport={f.sport} trainingDays={f.training_days} onDone={next} />;
  if (step === 8) return <FirstAction athlete={athlete} />;

  return (
    <>
      <div className="px-5 pt-5" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <ProgressBar filled={3 + step} total={TOTAL} />
      </div>

      {step === 0 && (
        <StepShell eyebrow="Step 3" title="WHAT DO WE CALL YOU?" onBack={back} canBack={false}>
          {isMinor && (
            <p className="text-xs text-tx-tertiary mb-4">
              Guardian approval comes later — for purchases and public competition. Training never needs it.
            </p>
          )}
          <Field label="Name or handle" type="text" value={f.display_name} placeholder="e.g. J. Carter"
                 maxLength={40} autoFocus onChange={(e) => set("display_name", e.target.value)} />
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!f.display_name.trim()}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell eyebrow="Step 4" title="YOUR SPORT." onBack={back} canBack>
          <div className="grid grid-cols-2 gap-2 mb-5">
            {SPORTS.map(([v, l]) => <Chip key={v} selected={f.sport === v} onClick={() => set("sport", v)}>{l}</Chip>)}
          </div>
          <Field label="Position (optional)" type="text" value={f.position} placeholder="e.g. WR, Point Guard, Setter"
                 onChange={(e) => set("position", e.target.value)} />
          <span className="block text-sm font-medium text-tx-secondary mb-2">Grade</span>
          <div className="flex flex-wrap gap-2 mb-6">
            {GRADES.map(([v, l]) => <Chip key={v} selected={f.grade === v} onClick={() => set("grade", v)}>{l}</Chip>)}
          </div>
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!f.sport}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell eyebrow="Step 5" title="WHERE ARE YOU IN YOUR SZN?" onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-4">This changes your drill mix and training volume.</p>
          <div className="flex flex-col gap-2 mb-6">
            {SEASONS.map(([v, l]) => <Chip key={v} selected={f.season_status === v} onClick={() => set("season_status", v)}>{l}</Chip>)}
          </div>
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!f.season_status}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell eyebrow="Step 6" title="WHAT ARE YOU CHASING?" onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-4">Pick everything that applies.</p>
          <div className="grid grid-cols-1 gap-2 mb-2">
            {GOALS.map(([v, l]) => (
              <Chip key={v} selected={f.goals.includes(v)}
                    onClick={() => set("goals", f.goals.includes(v) ? f.goals.filter((g) => g !== v) : [...f.goals, v])}>
                {l}
              </Chip>
            ))}
          </div>
          {isMinor && f.goals.includes("make_weight") && (
            <p className="text-xs text-tx-tertiary mb-4">
              You're still growing. We'll fuel performance and let training do the work.
            </p>
          )}
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={f.goals.length === 0}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell eyebrow="Step 7" title="THE NUMBERS." onBack={back} canBack>
          <span className="block text-sm font-medium text-tx-secondary mb-1">Sex</span>
          <p className="text-xs text-tx-tertiary mb-2">Used to calculate your calorie needs. Never shown on your profile.</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {SEXES.map(([v, l]) => <Chip key={v} selected={f.biological_sex === v} onClick={() => set("biological_sex", v)}>{l}</Chip>)}
          </div>
          <Field label="Weight (lbs)" type="number" inputMode="decimal" min={50} max={500}
                 value={f.weight_lbs} onChange={(e) => set("weight_lbs", e.target.value)} />
          <div className="flex gap-3">
            <div className="flex-1"><Field label="Height (ft)" type="number" min={3} max={7} value={f.height_ft} onChange={(e) => set("height_ft", e.target.value)} /></div>
            <div className="flex-1"><Field label="(in)" type="number" min={0} max={11} value={f.height_in} onChange={(e) => set("height_in", e.target.value)} /></div>
          </div>
          {!isMinor && (
            <Field label="Goal weight (lbs, optional)" type="number" inputMode="decimal" min={50} max={500}
                   value={f.goal_weight_lbs} onChange={(e) => set("goal_weight_lbs", e.target.value)} />
          )}
          <span className="block text-sm font-medium text-tx-secondary mb-2">Training days per week</span>
          <div className="flex flex-wrap gap-2 mb-6">
            {DAYS.map(([l, v]) => <Chip key={l} selected={f.training_days === v} onClick={() => set("training_days", v)}>{l}</Chip>)}
          </div>
          <div className="mt-auto">
            <PrimaryButton onClick={next} disabled={!f.biological_sex || !f.weight_lbs || !f.height_ft}>Continue</PrimaryButton>
          </div>
        </StepShell>
      )}

      {step === 5 && (
        <StepShell eyebrow="Step 8" title="WHAT DO YOU TRAIN WITH?" onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-4">We'll only recommend drills you can actually run.</p>
          <div className="flex flex-col gap-2 mb-6">
            {EQUIPMENT.map(([v, l]) => <Chip key={v} selected={f.equipment_access === v} onClick={() => set("equipment_access", v)}>{l}</Chip>)}
          </div>
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!f.equipment_access}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 6 && (
        <StepShell eyebrow="Step 9" title="ANYTHING WE SHOULD KNOW?" onBack={back} canBack>
          <div className="flex gap-2 mb-4">
            <Chip selected={f.has_limitations === true} onClick={() => set("has_limitations", true)}>Yes</Chip>
            <Chip selected={f.has_limitations === false} onClick={() => set("has_limitations", false)}>No, all clear</Chip>
          </div>
          {f.has_limitations && (
            <Field label="What's going on?" type="text" value={f.limitations_note}
                   placeholder="e.g. recovering from an ankle sprain"
                   onChange={(e) => set("limitations_note", e.target.value)} />
          )}
          <p className="text-xs text-tx-tertiary mb-4">
            We'll steer you around it. Not medical advice — if it's serious, see a doctor.
          </p>
          {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <PrimaryButton onClick={saveAndBuild} disabled={saving}>
              {saving ? "Building…" : "Build my OFFSZN"}
            </PrimaryButton>
            <SkipButton onClick={() => { set("has_limitations", false); saveAndBuild(); }} />
          </div>
        </StepShell>
      )}
    </>
  );
}