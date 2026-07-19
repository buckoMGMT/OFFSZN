// Coach onboarding path (§4): a coach is a seller, not a trainee.
// Credibility → storefront → services → rate → minor conduct (required) →
// identity → payouts → GET DISCOVERABLE checklist.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ProgressBar, StepShell, PrimaryButton, SkipButton, Chip, Field } from "@/components/onboarding/OnboardingUI";
import CoachChecklist from "@/components/onboarding/CoachChecklist";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "boxing", "mma", "swimming", "lacrosse", "tennis", "softball", "cross_country", "golf", "other"];
const SPECIALTIES = ["Speed", "Strength", "Route running", "Shooting", "Footwork", "Recovery", "Nutrition", "Conditioning"];
const LEVELS = [["youth", "Youth"], ["middle_school", "Middle school"], ["high_school", "High school"], ["college", "College"], ["semi_pro", "Semi-pro"], ["pro", "Pro"], ["private", "Private clients"]];
const SLAS = [24, 48, 72];
const SERVICES = [
  ["form_checks", "Form-check video reviews", "Encouraged: highest-converting add-on"],
  ["weekly_programming", "Weekly programming", null],
  ["progress_checkins", "Monthly progress check-ins", null],
];
const TOTAL = 12;

function suggestedBand(years) {
  const y = Number(years) || 0;
  if (y >= 8) return "$35–75/mo";
  if (y >= 3) return "$20–40/mo";
  return "$10–20/mo";
}

export default function CoachPath() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [athlete, setAthlete] = useState(null);
  const [f, setF] = useState({
    display_name: "", sports: [], specialties: [], years: "", levels: [], certifications: "",
    bio: "", avatar_url: "", services: ["messaging"], sla: 48, price: "", conductAgreed: false,
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleIn = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);

  const next = () => {
    base44.analytics.track({ eventName: "onboarding_step_completed", properties: { path: "coach", step } });
    setError(null); setStep((s) => s + 1);
  };
  const back = () => { setError(null); setStep((s) => Math.max(0, s - 1)); };

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("avatar_url", file_url);
    } catch { setError("Photo upload failed — try again."); }
    setSaving(false);
  }

  async function saveRecord() {
    setSaving(true); setError(null);
    try {
      const payload = {
        display_name: f.display_name.trim(),
        sport: f.sports[0] || "other",
        role: "coach",
        avatar_url: f.avatar_url || undefined,
        coach_bio: f.bio.trim().slice(0, 300) || undefined,
        coach_specialties: f.specialties,
        coach_years_experience: parseFloat(f.years) || undefined,
        coach_levels_coached: f.levels,
        coach_certifications: f.certifications.trim() || undefined,
        coach_services: f.services.includes("messaging") ? f.services : ["messaging", ...f.services],
        coach_response_sla_hours: f.sla,
        coach_sub_price_usd: parseFloat(f.price) || undefined,
        minor_conduct_agreed_at: new Date().toISOString(),
        coach_profile_complete: false, // flips only when the full discoverability gate clears
        onboarding_complete: true,
      };
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
      const existing = await base44.entities.Athlete.list("-created_date", 1);
      const rec = existing?.length
        ? await base44.entities.Athlete.update(existing[0].id, payload)
        : await base44.entities.Athlete.create(payload);
      setAthlete(rec);
      base44.analytics.track({ eventName: "onboarding_completed", properties: {
        role: "coach", sport: payload.sport, is_minor: false, training_days: 0, season_status: "off_season",
      }});
      next();
    } catch { setError("Couldn't save your profile. Try again."); }
    setSaving(false);
  }

  async function startIdentity() {
    setSaving(true); setError(null);
    try {
      const res = await base44.functions.invoke("verifyCoachIdentity", { returnUrl: window.location.origin });
      if (res.data?.status === "verified") setAthlete((a) => ({ ...a, identity_status: "verified" }));
      else if (res.data?.url) { window.open(res.data.url, "_blank"); setAthlete((a) => ({ ...a, identity_status: "pending" })); }
      next();
    } catch (e) { setError(e.response?.data?.error || "Couldn't start verification. You can retry from your Coach tab."); }
    setSaving(false);
  }

  async function startPayouts() {
    setSaving(true); setError(null);
    try {
      const res = await base44.functions.invoke("stripeConnectOnboard", { returnUrl: window.location.origin });
      if (res.data?.status === "complete") setAthlete((a) => ({ ...a, stripe_onboarding_status: "complete" }));
      else if (res.data?.url) { window.open(res.data.url, "_blank"); setAthlete((a) => ({ ...a, stripe_onboarding_status: "pending" })); }
      next();
    } catch (e) { setError(e.response?.data?.error || "Couldn't start payout setup. You can retry from your Coach tab."); }
    setSaving(false);
  }

  const price = parseFloat(f.price) || 0;

  return (
    <>
      <div className="px-5 pt-5" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <ProgressBar filled={3 + step} total={TOTAL} />
      </div>

      {step === 0 && (
        <StepShell eyebrow="Coach setup" title="WHAT DO ATHLETES CALL YOU?" canBack={false}>
          <Field label="Coach name" type="text" value={f.display_name} placeholder="e.g. Coach Carter"
                 maxLength={40} autoFocus onChange={(e) => set("display_name", e.target.value)} />
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!f.display_name.trim()}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 1 && (
        <StepShell eyebrow="Credibility" title="WHAT DO YOU COACH?" onBack={back} canBack>
          <span className="block text-sm font-medium text-tx-secondary mb-2">Sport(s)</span>
          <div className="grid grid-cols-3 gap-2 mb-5">
            {SPORTS.map((s) => <Chip key={s} selected={f.sports.includes(s)} onClick={() => toggleIn("sports", s)}>{s.replace("_", " ")}</Chip>)}
          </div>
          <span className="block text-sm font-medium text-tx-secondary mb-2">Specialties</span>
          <div className="flex flex-wrap gap-2 mb-5">
            {SPECIALTIES.map((s) => <Chip key={s} selected={f.specialties.includes(s)} onClick={() => toggleIn("specialties", s)}>{s}</Chip>)}
          </div>
          <Field label="Years coaching" type="number" min={0} max={60} value={f.years} onChange={(e) => set("years", e.target.value)} />
          <span className="block text-sm font-medium text-tx-secondary mb-2">Levels coached</span>
          <div className="flex flex-wrap gap-2 mb-5">
            {LEVELS.map(([v, l]) => <Chip key={v} selected={f.levels.includes(v)} onClick={() => toggleIn("levels", v)}>{l}</Chip>)}
          </div>
          <Field label="Certifications / affiliations (optional)" type="text" value={f.certifications}
                 placeholder="e.g. CSCS, USA Football" onChange={(e) => set("certifications", e.target.value)}
                 hint="Coaches who list credentials convert ~2× better" />
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={f.sports.length === 0}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 2 && (
        <StepShell eyebrow="Your storefront" title="SELL YOURSELF IN 300 CHARACTERS." onBack={back} canBack>
          <label className="block mb-4">
            <span className="block text-sm font-medium text-tx-secondary mb-2">Bio</span>
            <textarea value={f.bio} maxLength={300} rows={4}
              placeholder="10 years coaching WRs. Sent 6 athletes D1. I teach releases, not drills."
              onChange={(e) => set("bio", e.target.value)}
              className="w-full rounded-md text-base px-4 py-3 text-tx-primary resize-none"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border-strong)" }} />
            <span className="block text-xs text-tx-tertiary mt-1 tabular-nums">{f.bio.length}/300</span>
          </label>
          <span className="block text-sm font-medium text-tx-secondary mb-2">Profile photo — required. A faceless coach doesn't sell.</span>
          <div className="flex items-center gap-3 mb-6">
            {f.avatar_url && <img src={f.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: "2px solid var(--accent)" }} />}
            <label className="btn-secondary cursor-pointer" style={{ minHeight: 44 }}>
              {saving ? "Uploading…" : f.avatar_url ? "Change photo" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
            </label>
          </div>
          {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!f.bio.trim() || !f.avatar_url}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 3 && (
        <StepShell eyebrow="Your service" title="WHAT YOUR SUBSCRIPTION INCLUDES." onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-4">
            OFFSZN subscriptions are 1-on-1 coaching services. Pick what yours includes — athletes see this before they subscribe.
          </p>
          <div className="rounded-md border px-4 py-3 mb-2 flex items-center justify-between"
               style={{ background: "var(--accent-subtle)", borderColor: "var(--accent)" }}>
            <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>Messaging</span>
            <span className="text-xs text-tx-tertiary">Included in every subscription</span>
          </div>
          <div className="flex flex-col gap-2 mb-5">
            {SERVICES.map(([v, l, hint]) => (
              <div key={v}>
                <Chip selected={f.services.includes(v)} onClick={() => toggleIn("services", v)}>{l}</Chip>
                {hint && <p className="text-xs text-tx-tertiary mt-1 px-1">{hint}</p>}
              </div>
            ))}
          </div>
          <span className="block text-sm font-medium text-tx-secondary mb-2">Your response time</span>
          <div className="flex gap-2 mb-6">
            {SLAS.map((h) => <Chip key={h} selected={f.sla === h} onClick={() => set("sla", h)}>{h}h</Chip>)}
          </div>
          <div className="mt-auto"><PrimaryButton onClick={next}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 4 && (
        <StepShell eyebrow="Your rate" title="SET YOUR MONTHLY PRICE." onBack={back} canBack>
          <Field label="Monthly price (USD)" type="number" inputMode="decimal" min={1} max={500}
                 value={f.price} placeholder="e.g. 25" onChange={(e) => set("price", e.target.value)}
                 hint={`Suggested for your experience: ${suggestedBand(f.years)} — your call, never forced.`} />
          {price > 0 && (
            <div className="rounded-md border p-4 mb-4" style={{ background: "var(--surface-1)", borderColor: "var(--border-subtle)" }}>
              <p className="text-sm text-tx-primary tabular-nums">
                At ${price.toFixed(0)}/mo × 20 athletes = <span style={{ color: "var(--accent)" }}>${(price * 20).toFixed(0)}/mo</span> before platform fee.
              </p>
            </div>
          )}
          <div className="mt-auto"><PrimaryButton onClick={next} disabled={!price}>Continue</PrimaryButton></div>
        </StepShell>
      )}

      {step === 5 && (
        <StepShell eyebrow="Required" title="WORKING WITH MINORS." onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-4">Most OFFSZN athletes are 13–17. Before you coach here, agree to this:</p>
          <ul className="space-y-3 mb-5 text-sm text-tx-primary">
            <li>• All coach↔athlete messaging is logged and subject to moderation.</li>
            <li>• Minors require a verified guardian before subscribing to you.</li>
            <li>• No off-platform contact with a minor athlete — no personal phone, no DMs on other apps. This is a bright line; violating it ends the account.</li>
            <li>• Report anything that concerns you.</li>
          </ul>
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input type="checkbox" checked={f.conductAgreed} onChange={(e) => set("conductAgreed", e.target.checked)}
                   className="mt-1 w-4 h-4" style={{ accentColor: "var(--accent)" }} />
            <span className="text-sm text-tx-secondary">I understand and agree to these rules for working with minor athletes.</span>
          </label>
          {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
          <div className="mt-auto">
            <PrimaryButton onClick={saveRecord} disabled={!f.conductAgreed || saving}>
              {saving ? "Saving…" : "Agree & continue"}
            </PrimaryButton>
          </div>
        </StepShell>
      )}

      {step === 6 && (
        <StepShell eyebrow="Trust & safety" title="VERIFY YOUR IDENTITY." onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-2">
            Athletes' parents need to know who you are. This protects your name as much as theirs.
          </p>
          <p className="text-tx-secondary text-sm mb-4">
            Government ID + selfie, via Stripe Identity. You can build your library now — you can't be subscribed to or paid until this clears.
          </p>
          {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <PrimaryButton onClick={startIdentity} disabled={saving}>{saving ? "Opening…" : "Verify my identity"}</PrimaryButton>
            <SkipButton onClick={next} />
          </div>
        </StepShell>
      )}

      {step === 7 && (
        <StepShell eyebrow="Getting paid" title="CONNECT YOUR PAYOUTS." onBack={back} canBack>
          <p className="text-tx-secondary text-sm mb-4">
            Connect your bank through Stripe. You keep 80% of every subscription — paid out automatically.
          </p>
          {error && <p className="text-sm mb-4" style={{ color: "var(--negative)" }}>{error}</p>}
          <div className="mt-auto flex flex-col gap-2">
            <PrimaryButton onClick={startPayouts} disabled={saving}>{saving ? "Opening Stripe…" : "Set up payouts"}</PrimaryButton>
            <SkipButton onClick={next} />
          </div>
        </StepShell>
      )}

      {step === 8 && (
        <StepShell eyebrow="Almost there" title="UPLOAD YOUR FIRST DRILL." canBack={false}>
          <p className="text-tx-secondary text-sm mb-4">
            A coach with an empty library doesn't convert. You need 3 drills to go live — start with one now in your Coach Studio.
          </p>
          <div className="mb-6"><CoachChecklist athlete={athlete || {}} /></div>
          <div className="mt-auto flex flex-col gap-2">
            <PrimaryButton onClick={() => navigate("/profile", { replace: true })}>Open Coach Studio</PrimaryButton>
            <SkipButton onClick={() => navigate("/", { replace: true })} children="Enter OFFSZN — I'll upload later" />
          </div>
        </StepShell>
      )}
    </>
  );
}