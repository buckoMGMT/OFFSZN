// OFFSZN onboarding v2 — role-split flow. Welcome → age gate → athlete/coach
// split (segment by role FIRST), then two completely different paths.
import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { ProgressBar, StepShell, PrimaryButton, Chip, Field } from "@/components/onboarding/OnboardingUI";
import AthletePath from "@/components/onboarding/AthletePath";
import CoachPath from "@/components/onboarding/CoachPath";
import { readDraft, saveDraft } from "@/lib/onboardingDraft";
import { track } from "@/lib/analytics";

const TOTAL = 12;

export default function Onboarding() {
  const reduced = useReducedMotion();
  // Restore a mid-flow draft — a refresh must never wipe typed answers (2.1).
  const draft = readDraft();
  const [phase, setPhase] = useState(draft.phase ?? 0); // 0 welcome · 1 dob · 2 role · 3 path
  const [role, setRole] = useState(draft.role ?? null); // "athlete" | "coach"
  const [dob, setDob] = useState(draft.dob ?? "");
  const [isMinor, setIsMinor] = useState(draft.isMinor ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => { saveDraft({ phase, role, dob, isMinor }); }, [phase, role, dob, isMinor]);

  // Funnel: every step view (3.1). Drop-off = last step_viewed with no successor.
  useEffect(() => { track.onboardingStepViewed({ path: "shared", phase }); }, [phase]);

  const anim = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 },
        transition: { duration: 0.25, ease: [0.2, 0, 0, 1] } };

  async function submitDob() {
    setSaving(true); setError(null);
    try {
      const { data } = await base44.functions.invoke("ageGate", { date_of_birth: dob });
      setIsMinor(data?.is_minor ?? true);
      base44.analytics.track({ eventName: "onboarding_step_completed", properties: { path: "shared", step: "dob" } });
      setPhase(2);
    } catch (err) {
      if (err?.response?.status === 403) { setBlocked(true); track.onboardingBlocked(); }
      else setError("Couldn't verify your date of birth. Check it and try again.");
    } finally { setSaving(false); }
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5"
           style={{ background: "var(--surface-0)", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="text-center" style={{ maxWidth: 420 }}>
          <h1 className="font-display text-2xl text-tx-primary mb-3">NOT YET — BUT SOON.</h1>
          <p className="text-tx-secondary text-base">
            OFFSZN is for athletes 13 and older. Keep training — we'll be here when you're ready.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 3) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-0)" }}>
        {role === "coach" ? <CoachPath /> : <AthletePath dob={dob} isMinor={isMinor} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--surface-0)" }}>
      <div className="px-5" style={{ maxWidth: 480, margin: "0 auto", width: "100%", paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}>
        <ProgressBar filled={phase + 1} total={TOTAL} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={phase} {...anim} className="flex-1 flex flex-col">

          {phase === 0 && (
            <StepShell eyebrow="Account created ✓" title="LET'S BUILD YOUR OFFSZN.">
              <p className="text-tx-secondary mb-8">Two minutes. A few questions. Then you're on the field.</p>
              <div className="mt-auto"><PrimaryButton onClick={() => setPhase(1)}>Start</PrimaryButton></div>
            </StepShell>
          )}

          {phase === 1 && (
            <StepShell eyebrow="Step 1" title="WHEN WERE YOU BORN?" onBack={() => setPhase(0)} canBack>
              <Field label="Date of birth" type="date" value={dob}
                     max={new Date().toISOString().slice(0, 10)}
                     onChange={(e) => setDob(e.target.value)} />
              <p className="text-xs text-tx-tertiary mb-6">
                OFFSZN is for athletes 13+. We use this once to verify age — it's never shown on your profile.
              </p>
              {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
              <div className="mt-auto">
                <PrimaryButton onClick={submitDob} disabled={!dob || saving}>
                  {saving ? "Checking…" : "Continue"}
                </PrimaryButton>
              </div>
            </StepShell>
          )}

          {phase === 2 && (
            <StepShell eyebrow="Step 2" title="WHO ARE YOU HERE AS?" onBack={() => setPhase(1)} canBack>
              <div className="flex flex-col gap-3 mb-3">
                <Chip selected={role === "athlete"} onClick={() => setRole("athlete")}>
                  I'm an athlete — here to train
                </Chip>
                <Chip selected={role === "coach"} onClick={() => setRole("coach")}>
                  I'm a coach — here to train athletes
                </Chip>
              </div>
              <p className="text-xs text-tx-tertiary mb-4">
                Coaches set a monthly rate and keep the majority of every subscription.
              </p>
              <div className="mt-auto">
                <PrimaryButton onClick={() => setPhase(3)} disabled={!role}>Continue</PrimaryButton>
              </div>
            </StepShell>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}