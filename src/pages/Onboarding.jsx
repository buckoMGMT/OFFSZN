// OFFSZN onboarding — runs immediately after account creation, OUTSIDE AppLayout.
// One question per screen (Hick's law), endowed-progress bar, 250ms transitions
// with reduced-motion fallback. Under-13 → kind full-screen stop, no retry loop.
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { base44 } from "@/api/base44Client";

const SPORTS = [
  ["football", "Football"], ["basketball", "Basketball"], ["baseball", "Baseball"],
  ["soccer", "Soccer"], ["track", "Track & Field"], ["volleyball", "Volleyball"],
  ["wrestling", "Wrestling"], ["swimming", "Swimming"], ["lacrosse", "Lacrosse"],
  ["tennis", "Tennis"], ["softball", "Softball"], ["cross_country", "Cross Country"],
  ["golf", "Golf"], ["other", "Other"],
];

const GRADES = [
  ["freshman", "Freshman"], ["sophomore", "Sophomore"],
  ["junior", "Junior"], ["senior", "Senior"], ["college", "College"],
];

const GOALS = [
  ["starting_spot", "Earn the starting spot"],
  ["gain_muscle", "Gain muscle"],
  ["cut_weight", "Cut weight"],
  ["get_faster", "Get faster"],
  ["recruiting", "Get recruited"],
  ["stay_ready", "Stay ready in the offseason"],
];

const TOTAL_STEPS = 8;

/* Macro targets: protein = 1g/lb; calories = weight × (18 gain / 12.5 cut / 15.5 else)
   rounded to 50; fats = 0.4g/lb; carbs = remainder ÷ 4. */
function computeMacroTargets(weightLbs, goals) {
  if (!weightLbs) return {};
  const gaining = goals.includes("gain_muscle");
  const cutting = goals.includes("cut_weight");
  const calPerLb = gaining ? 18 : cutting ? 12.5 : 15.5;
  const calories = Math.round((weightLbs * calPerLb) / 50) * 50;
  const protein = Math.round(weightLbs * 1.0);
  const fats = Math.round(weightLbs * 0.4);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));
  return { goal_calories: calories, goal_protein_g: protein, goal_fats_g: fats, goal_carbs_g: carbs };
}

function ProgressBar({ step }) {
  // Endowed progress: account creation counts as the first filled segment.
  const filled = step + 1;
  return (
    <div className="flex gap-1 w-full" role="progressbar"
         aria-valuenow={filled} aria-valuemin={1} aria-valuemax={TOTAL_STEPS + 1}>
      {Array.from({ length: TOTAL_STEPS + 1 }).map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full"
             style={{ background: i < filled ? "var(--accent)" : "var(--surface-3)" }} />
      ))}
    </div>
  );
}

function StepShell({ eyebrow, title, children, onBack, canBack }) {
  return (
    <div className="flex flex-col min-h-full px-5 pt-6 pb-8 flex-1" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
      {canBack && (
        <button onClick={onBack} aria-label="Back"
                className="self-start mb-4 text-tx-secondary text-sm font-medium">
          ← Back
        </button>
      )}
      <span className="eyebrow" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>
        {eyebrow}
      </span>
      <h1 className="font-display text-2xl text-tx-primary mt-2 mb-6" style={{ textWrap: "balance" }}>
        {title}
      </h1>
      {children}
    </div>
  );
}

function PrimaryButton({ children, disabled, onClick, type = "button" }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className="w-full font-semibold text-base rounded-md transition-transform active:scale-[0.98] disabled:opacity-40"
      style={{ height: 52, background: "var(--accent)", color: "var(--on-accent)" }}>
      {children}
    </button>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className="rounded-md text-sm font-medium px-4 transition-colors"
      style={{
        height: 44,
        background: selected ? "var(--accent-subtle)" : "var(--surface-1)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
        color: selected ? "var(--accent)" : "var(--text-primary)",
      }}>
      {children}
    </button>
  );
}

function Field({ label, hint, ...inputProps }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-tx-secondary mb-2">{label}</span>
      <input {...inputProps}
        className="w-full rounded-md text-base px-4 text-tx-primary"
        style={{ height: 52, background: "var(--surface-1)", border: "1px solid var(--border-strong)" }} />
      {hint && <span className="block text-xs text-tx-tertiary mt-1">{hint}</span>}
    </label>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(false); // under-13 hard stop

  const [form, setForm] = useState({
    dob: "", isMinor: null,
    display_name: "",
    sport: "", position: "", grade: "", school: "",
    goals: [],
    weight_lbs: "", height_ft: "", height_in: "", goal_weight_lbs: "",
    bench_press_lbs: "", squat_lbs: "", deadlift_lbs: "", mile_min: "", mile_sec: "",
    wantsCoach: null,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const next = () => { setError(null); setStep((s) => s + 1); };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  const anim = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 },
        transition: { duration: 0.25, ease: [0.2, 0, 0, 1] } };

  /* -- Step 1: THE AGE GATE — server-verified, not client-trusted -- */
  async function submitDob() {
    setSaving(true); setError(null);
    try {
      const { data } = await base44.functions.invoke("ageGate", { date_of_birth: form.dob });
      set("isMinor", data?.is_minor ?? true);
      next();
    } catch (err) {
      const status = err?.response?.status;
      if (status === 403) {
        setBlocked(true); // under 13 — hard stop, kind copy, no retry loop
      } else {
        setError("Couldn't verify your date of birth. Check it and try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  /* -- Finish: write the Athlete record -- */
  async function finish() {
    setSaving(true); setError(null);
    try {
      const heightIn =
        (parseInt(form.height_ft || 0, 10) * 12) + parseInt(form.height_in || 0, 10);
      const mileSeconds =
        (parseInt(form.mile_min || 0, 10) * 60) + parseInt(form.mile_sec || 0, 10);
      const macros = computeMacroTargets(parseFloat(form.weight_lbs), form.goals);

      const payload = {
        display_name: form.display_name.trim(),
        sport: form.sport || "other",
        position: form.position.trim() || undefined,
        grade: form.grade || undefined,
        school: form.school.trim() || undefined,
        training_goals: form.goals,
        weight_lbs: parseFloat(form.weight_lbs) || undefined,
        height_inches: heightIn > 0 ? heightIn : undefined,
        goal_weight_lbs: parseFloat(form.goal_weight_lbs) || undefined,
        bench_press_lbs: parseFloat(form.bench_press_lbs) || undefined,
        squat_lbs: parseFloat(form.squat_lbs) || undefined,
        deadlift_lbs: parseFloat(form.deadlift_lbs) || undefined,
        mile_time_seconds: mileSeconds > 0 ? mileSeconds : undefined,
        // Coach intent sets role, but selling stays locked behind
        // identity verification + Stripe onboarding — the role alone
        // unlocks nothing money-related. That's by design.
        role: form.wantsCoach ? "coach" : "athlete",
        onboarding_complete: true,
        ...macros,
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      // Update the user's existing Athlete record if one exists, else create.
      const existing = await base44.entities.Athlete.list("-created_date", 1);
      if (existing?.length) {
        await base44.entities.Athlete.update(existing[0].id, payload);
      } else {
        await base44.entities.Athlete.create(payload);
      }
      setStep(8); // celebration screen
    } catch (err) {
      setError("Couldn't save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const macroPreview = useMemo(
    () => computeMacroTargets(parseFloat(form.weight_lbs), form.goals),
    [form.weight_lbs, form.goals]
  );

  /* -- Under-13 hard stop -- */
  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--surface-0)" }}>
        <div className="text-center" style={{ maxWidth: 420 }}>
          <h1 className="font-display text-2xl text-tx-primary mb-3">NOT YET — BUT SOON.</h1>
          <p className="text-tx-secondary text-base">
            OFFSZN is for athletes 13 and older. Keep training — we'll be here
            when you're ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-0)" }}>
      <div className="px-5 pt-5" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <ProgressBar step={step} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} {...anim} className="flex-1 flex flex-col">

          {/* 0 — WELCOME */}
          {step === 0 && (
            <StepShell eyebrow="Account created ✓" title="LET'S BUILD YOUR OFFSZN.">
              <p className="text-tx-secondary mb-8">
                Two minutes. A few questions. Then you're on the field.
              </p>
              <div className="mt-auto"><PrimaryButton onClick={next}>Start</PrimaryButton></div>
            </StepShell>
          )}

          {/* 1 — AGE GATE */}
          {step === 1 && (
            <StepShell eyebrow="Step 1" title="WHEN WERE YOU BORN?" onBack={back} canBack>
              <Field label="Date of birth" type="date" value={form.dob}
                     max={new Date().toISOString().slice(0, 10)}
                     onChange={(e) => set("dob", e.target.value)} />
              <p className="text-xs text-tx-tertiary mb-6">
                OFFSZN is for athletes 13+. We use this once to verify age — it's
                never shown on your profile.
              </p>
              {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
              <div className="mt-auto">
                <PrimaryButton onClick={submitDob} disabled={!form.dob || saving}>
                  {saving ? "Checking…" : "Continue"}
                </PrimaryButton>
              </div>
            </StepShell>
          )}

          {/* 2 — NAME */}
          {step === 2 && (
            <StepShell eyebrow="Step 2" title="WHAT DO WE CALL YOU?" onBack={back} canBack>
              {form.isMinor && (
                <p className="text-xs text-tx-tertiary mb-4">
                  Heads up: some features (coach purchases, public leaderboards)
                  will ask for a parent or guardian later. Training never does.
                </p>
              )}
              <Field label="Name or handle" type="text" value={form.display_name}
                     placeholder="e.g. J. Carter" maxLength={40} autoFocus
                     onChange={(e) => set("display_name", e.target.value)} />
              <div className="mt-auto">
                <PrimaryButton onClick={next} disabled={!form.display_name.trim()}>Continue</PrimaryButton>
              </div>
            </StepShell>
          )}

          {/* 3 — SPORT */}
          {step === 3 && (
            <StepShell eyebrow="Step 3" title="WHAT'S YOUR SPORT?" onBack={back} canBack>
              <div className="grid grid-cols-2 gap-2 mb-5">
                {SPORTS.map(([val, label]) => (
                  <Chip key={val} selected={form.sport === val} onClick={() => set("sport", val)}>{label}</Chip>
                ))}
              </div>
              <Field label="Position (optional)" type="text" value={form.position}
                     placeholder="e.g. WR, Point Guard, Setter"
                     onChange={(e) => set("position", e.target.value)} />
              <span className="block text-sm font-medium text-tx-secondary mb-2">Grade</span>
              <div className="flex flex-wrap gap-2 mb-6">
                {GRADES.map(([val, label]) => (
                  <Chip key={val} selected={form.grade === val} onClick={() => set("grade", val)}>{label}</Chip>
                ))}
              </div>
              <div className="mt-auto">
                <PrimaryButton onClick={next} disabled={!form.sport}>Continue</PrimaryButton>
              </div>
            </StepShell>
          )}

          {/* 4 — GOALS */}
          {step === 4 && (
            <StepShell eyebrow="Step 4" title="WHAT ARE YOU CHASING?" onBack={back} canBack>
              <p className="text-tx-secondary text-sm mb-4">Pick everything that applies.</p>
              <div className="grid grid-cols-1 gap-2 mb-6">
                {GOALS.map(([val, label]) => (
                  <Chip key={val} selected={form.goals.includes(val)}
                        onClick={() => set("goals", form.goals.includes(val)
                          ? form.goals.filter((g) => g !== val)
                          : [...form.goals, val])}>
                    {label}
                  </Chip>
                ))}
              </div>
              <div className="mt-auto">
                <PrimaryButton onClick={next} disabled={form.goals.length === 0}>Continue</PrimaryButton>
              </div>
            </StepShell>
          )}

          {/* 5 — BODY */}
          {step === 5 && (
            <StepShell eyebrow="Step 5" title="YOUR NUMBERS." onBack={back} canBack>
              <Field label="Current weight (lbs)" type="number" inputMode="decimal" min={50} max={500}
                     value={form.weight_lbs} onChange={(e) => set("weight_lbs", e.target.value)} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <Field label="Height (ft)" type="number" min={3} max={7}
                         value={form.height_ft} onChange={(e) => set("height_ft", e.target.value)} />
                </div>
                <div className="flex-1">
                  <Field label="(in)" type="number" min={0} max={11}
                         value={form.height_in} onChange={(e) => set("height_in", e.target.value)} />
                </div>
              </div>
              <Field label="Goal weight (lbs, optional)" type="number" inputMode="decimal" min={50} max={500}
                     value={form.goal_weight_lbs} onChange={(e) => set("goal_weight_lbs", e.target.value)}
                     hint={macroPreview.goal_calories
                       ? `Day 1 targets: ${macroPreview.goal_calories} cal · ${macroPreview.goal_protein_g}g protein — editable anytime`
                       : undefined} />
              <div className="mt-auto">
                <PrimaryButton onClick={next} disabled={!form.weight_lbs}>Continue</PrimaryButton>
              </div>
            </StepShell>
          )}

          {/* 6 — WEIGHT ROOM (skippable) */}
          {step === 6 && (
            <StepShell eyebrow="Step 6" title="WEIGHT ROOM NUMBERS?" onBack={back} canBack>
              <p className="text-tx-secondary text-sm mb-4">
                If you know your maxes, drop them in. If not, skip — you'll set
                them when you test.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[["bench_press_lbs", "Bench"], ["squat_lbs", "Squat"], ["deadlift_lbs", "Deadlift"]].map(([k, label]) => (
                  <div key={k}>
                    <Field label={`${label} (lbs)`} type="number" min={0} max={1500}
                           value={form[k]} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Field label="Mile (min)" type="number" min={0} max={30}
                         value={form.mile_min} onChange={(e) => set("mile_min", e.target.value)} />
                </div>
                <div className="flex-1">
                  <Field label="(sec)" type="number" min={0} max={59}
                         value={form.mile_sec} onChange={(e) => set("mile_sec", e.target.value)} />
                </div>
              </div>
              <div className="mt-auto flex flex-col gap-3">
                <PrimaryButton onClick={next}>Continue</PrimaryButton>
                <button onClick={next} className="text-tx-tertiary text-sm font-medium py-2">
                  Skip — I'll test later
                </button>
              </div>
            </StepShell>
          )}

          {/* 7 — ATHLETE OR COACH */}
          {step === 7 && (
            <StepShell eyebrow="Step 7" title="WHY ARE YOU HERE?" onBack={back} canBack>
              <div className="flex flex-col gap-3 mb-4">
                <Chip selected={form.wantsCoach === false} onClick={() => set("wantsCoach", false)}>
                  I'm an athlete — here to train
                </Chip>
                <Chip selected={form.wantsCoach === true} onClick={() => set("wantsCoach", true)}>
                  I'm a coach — here to train athletes
                </Chip>
              </div>
              {form.wantsCoach && (
                <p className="text-xs text-tx-tertiary mb-4">
                  Coaches set their own prices and keep the majority of every
                  sale. Before you can sell, you'll complete identity
                  verification — it protects your name and your athletes.
                </p>
              )}
              {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
              <div className="mt-auto">
                <PrimaryButton onClick={finish} disabled={form.wantsCoach === null || saving}>
                  {saving ? "Setting up…" : "Finish setup"}
                </PrimaryButton>
              </div>
            </StepShell>
          )}

          {/* 8 — DONE (the one celebration moment) */}
          {step === 8 && (
            <StepShell eyebrow="Day 1" title="YOUR OFFSZN STARTS NOW.">
              <p className="text-tx-secondary mb-2">
                Profile set. Targets locked{macroPreview.goal_calories ? ` — ${macroPreview.goal_calories} cal, ${macroPreview.goal_protein_g}g protein` : ""}.
              </p>
              <p className="text-tx-secondary mb-8">Log today and the streak begins.</p>
              <div className="mt-auto">
                <PrimaryButton onClick={() => navigate("/", { replace: true })}>
                  Take the field
                </PrimaryButton>
              </div>
            </StepShell>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}