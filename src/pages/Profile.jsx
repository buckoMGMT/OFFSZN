import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Crown, Edit2, Sun, Moon, Bell, LogOut, ChevronRight, Zap, HelpCircle, Shield, ShieldCheck, Settings as SettingsIcon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { useMilestoneNotifier } from "@/lib/MilestoneNotifier";
import BadgesSection from "@/components/profile/BadgesSection";
import StrengthMaxes from "@/components/profile/StrengthMaxes";
import HighlightReel from "@/components/profile/HighlightReel";
import RecruitingCard from "@/components/profile/RecruitingCard";
import CoachTier from "@/components/profile/CoachTier";
import CoachPayoutSetup from "@/components/profile/CoachPayoutSetup";
import CoachInbox from "@/components/messaging/CoachInbox";
import StampButton from "@/components/ui/StampButton";
import PlayDiagram from "@/components/ui/PlayDiagram";
import AvatarUpload from "@/components/profile/AvatarUpload";
import PassPaywallSheet from "@/components/monetization/PassPaywallSheet";
import Rewards from "@/pages/Rewards";
import AdvancedStats from "@/components/analytics/AdvancedStats";
import AccentColorPicker from "@/components/profile/AccentColorPicker";
import MacroRecompute from "@/components/profile/MacroRecompute";
import ManageSubscription from "@/components/profile/ManageSubscription";
import DeleteAccountSection from "@/components/profile/DeleteAccountSection";
import { Link } from "react-router-dom";
import { ageFromDob } from "@/lib/macroEngine";
import { validate, goalsSchema } from "@/lib/validators";
import ChipSelect from "@/components/ui/ChipSelect";
import useTabState from "@/lib/useTabState";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "boxing", "mma", "swimming", "lacrosse", "tennis", "softball", "cross_country", "golf", "athlete", "other"];
const GRADES = ["freshman", "sophomore", "junior", "senior", "college"];

// Flat subscription chip — never says "verified" (verification = identity only)
function PassChip() {
  return (
    <span className="px-2 py-1 rounded font-elite text-[9px] uppercase tracking-widest"
      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
      ALL-SZN
    </span>
  );
}

export default function Profile() {
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useTabState("profile.section", "stats");
  const { darkMode, setDarkMode } = useTheme();
  const { checkMilestones } = useMilestoneNotifier();
  const [notifications, setNotifications] = useState(() => localStorage.getItem('pb_notifs') !== 'off');
  const [units, setUnits] = useState(() => localStorage.getItem('pb_units') || 'imperial');
  const [privacy, setPrivacy] = useState(() => localStorage.getItem('pb_privacy') || 'public');
  const [showPaywall, setShowPaywall] = useState(false);
  const [isMinorUser, setIsMinorUser] = useState(false);
  // Weight is "verified" when it came from a logged DailyLog (not just typed on the card).
  const [weightVerified, setWeightVerified] = useState(false);
  // Athlete's clan — shown as a tappable badge in the header.
  const [clan, setClan] = useState(null);

  useEffect(() => {
    base44.auth.me().then((me) => {
      const age = ageFromDob(me?.date_of_birth);
      setIsMinorUser(age !== null && age < 18);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1).then((list) => {
      const a = list[0] || null;
      setAthlete(a);
      if (a) {
        setForm(a);
        checkMilestones(a);
        // A logged weight (from a DailyLog) is verified data vs a self-typed number.
        base44.entities.DailyLog.filter({ athlete_id: a.id, weight_lbs: { $gt: 0 } }, "-date", 1)
          .then((logs) => setWeightVerified(logs.length > 0))
          .catch(() => {});
        if (a.clan_id) {
          base44.entities.Clan.filter({ id: a.clan_id }, "-created_date", 1)
            .then((cs) => setClan(cs[0] || null))
            .catch(() => {});
        }
      }
      setLoading(false);
    });
  }, []);

  const [goalsError, setGoalsError] = useState(null);

  const save = async () => {
    if (!athlete) return;
    // §5 zod: goal fields bounded before any write
    const g = validate(goalsSchema, form);
    if (g.error) { setGoalsError(g.error); return; }
    setGoalsError(null);
    // Optimistic save — the UI responds instantly, the write happens in the background.
    const prev = athlete;
    setAthlete({ ...athlete, ...form });
    setEditing(false);
    try {
      const updated = await base44.entities.Athlete.update(athlete.id, form);
      setAthlete(updated);
    } catch {
      setAthlete(prev);
      setForm(prev);
      setGoalsError("Couldn't save your changes — check your connection and try again.");
    }
  };

  const createProfile = async () => {
    setSaving(true);
    const a = await base44.entities.Athlete.create({ display_name: "Athlete", subscription_tier: "free", current_streak_days: 0, total_points: 0, onboarding_complete: false });
    setAthlete(a);setForm(a);setEditing(true);setSaving(false);
  };

  const reload = () => base44.entities.Athlete.list("-created_date", 1).then((list) => {if (list[0]) {setAthlete(list[0]);setForm(list[0]);}});

  if (loading) return (
    <div className="px-5 pt-5 space-y-4" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="flex items-center gap-3">
        <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 8 }} />
        <div className="flex-1 space-y-2">
          <div className="skeleton" style={{ width: '55%', height: 20 }} />
          <div className="skeleton" style={{ width: '35%', height: 12 }} />
        </div>
      </div>
      <div className="skeleton" style={{ width: '100%', height: 34, borderRadius: 'var(--r-sm)' }} />
      <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 'var(--r-lg)' }} />
      <div className="skeleton" style={{ width: '100%', height: 80, borderRadius: 'var(--r-lg)' }} />
    </div>);


  if (!athlete) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--surface-0)' }}>
      <PlayDiagram size={160} />
      <h1 style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 'var(--text-3xl)', color: 'var(--text-primary)', textTransform: 'uppercase', marginTop: 24, marginBottom: 8 }}>Welcome to OFFSZN</h1>
      <p className="font-work text-sm mb-8 max-w-xs" style={{ color: 'var(--text-secondary)' }}>Every champion needs a system. Build your player card.</p>
      <StampButton onClick={createProfile} disabled={saving} className="text-base px-8 py-3 mt-2">
        {saving ? "Creating..." : "Build My Card"}
      </StampButton>
    </div>);


  const isPremium = athlete.subscription_tier === "premium";
  const isCoach = athlete.role === "coach";

  const bg = darkMode ? '#0D0D0F' : '#EDEEF0';
  const surface = darkMode ? '#1B1B1D' : '#DCDEE1';
  const headerBg = darkMode ? '#1B1B1D' : '#DCDEE1';
  const ink = darkMode ? '#EDEEF0' : '#15151A';
  const inkSoft = darkMode ? '#9BA3AC' : '#5A5D63';
  const border = darkMode ? '#5E646B' : '#9BA3AC';

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Player ID card header */}
      <div className="px-5 pt-5 pb-5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            {/* Avatar — camera badge appears in edit mode only */}
            <AvatarUpload athlete={athlete} onUpdated={reload} editable={editing} />
            <div>
              <h1 className="font-anton text-xl uppercase leading-tight" style={{ color: 'var(--theme-ink)' }}>{athlete.display_name || "Athlete"}</h1>
              {/* Role-aware meta — coaches show coaching identity, never grade/position */}
              <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>
                {isCoach
                  ? [athlete.sport ? `${athlete.sport.replace(/_/g, " ")} coach` : "coach", athlete.coach_years_experience ? `${athlete.coach_years_experience} yrs` : null, ...(athlete.coach_levels_coached || []).slice(0, 2).map((l) => l.replace(/_/g, " "))].filter(Boolean).join(" · ")
                  : [athlete.sport?.replace(/_/g, " "), athlete.position, athlete.grade].filter(Boolean).join(" · ")}
              </p>
              {athlete.school && <p className="font-work text-xs" style={{ color: 'var(--theme-ink-soft)' }}>{athlete.school}</p>}
              {isCoach && athlete.is_coach_verified &&
                <span className="inline-flex items-center gap-1 mt-1.5 mr-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(47,191,113,0.12)', border: '1px solid var(--positive)' }}>
                  <ShieldCheck size={10} style={{ color: 'var(--positive)' }} />
                  <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--positive)' }}>Verified Coach</span>
                </span>
              }
              {clan &&
                <Link to="/clans" className="inline-flex items-center gap-1 mt-1.5 px-2 py-1 rounded-full"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                  <Shield size={10} style={{ color: 'var(--accent)' }} />
                  <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>{clan.name}</span>
                </Link>
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Settings lives behind the gear — not a tab */}
            <button onClick={() => setActiveSection("settings")} aria-label="Settings" className="p-2 rounded"
            style={{
              background: activeSection === "settings" ? 'var(--accent-subtle)' : 'var(--theme-bg)',
              border: `1px solid ${activeSection === "settings" ? 'var(--accent)' : 'var(--theme-border)'}`
            }}>
              <SettingsIcon size={14} style={{ color: activeSection === "settings" ? 'var(--accent)' : 'var(--theme-ink-soft)' }} />
            </button>
            <button onClick={() => setEditing(!editing)} className="flex items-center gap-1 px-2.5 py-1.5 rounded font-elite text-[9px] uppercase tracking-widest"
            style={{ background: editing ? 'var(--accent-subtle)' : 'var(--theme-bg)', border: `1px solid ${editing ? 'var(--accent)' : 'var(--theme-border)'}`, color: editing ? 'var(--accent)' : 'var(--theme-ink-soft)' }}>
              <Edit2 size={10} /> Edit
            </button>
          </div>
        </div>

        {/* Stats strip — icon, number, and chip centered on one axis */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          {/* Points → tap into the Locker Room (rewards) */}
          <Link to="/rewards" className="flex items-center gap-1.5" style={{ lineHeight: 1 }}>
            <Trophy size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="font-elite text-sm" style={{ color: 'var(--theme-ink)', lineHeight: 1 }}>{(athlete.total_points || 0).toLocaleString()}</span>
            <span className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)', lineHeight: 1 }}>pts</span>
          </Link>
          {athlete.current_streak_days > 0 &&
          <div className="flex items-center gap-1.5" style={{ lineHeight: 1 }}>
              <span className="font-elite text-sm" style={{ color: 'var(--accent)', lineHeight: 1 }}>{athlete.current_streak_days}</span>
                <span className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)', lineHeight: 1 }}>SZN Streak</span>
            </div>
          }
          {isPremium ?
          <div className="ml-auto flex items-center gap-2">
                <button onClick={() => setShowPaywall(true)} className="px-2 py-1 rounded font-elite text-[9px] uppercase tracking-widest"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', background: 'transparent' }}>Compare Plans</button>
                <PassChip />
              </div> :
          <button onClick={() => setShowPaywall(true)} className="ml-auto font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Get ALL-SZN Pass →</button>
          }
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b px-5" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-0)' }}>
        {[
        { id: "stats", label: "Stats" },
        { id: "badges", label: "Badges" },
        { id: "goals", label: "Goals" },
        { id: "locker", label: "Locker" },
        // Coach tab is role-gated; Settings lives behind the header gear
        ...(isCoach ? [{ id: "coach", label: "Coach" }] : [])].
        map((s) =>
        <button key={s.id} onClick={() => setActiveSection(s.id)}
        className="flex-1 py-3 font-elite text-[9px] uppercase tracking-widest"
        style={{
          color: activeSection === s.id ? 'var(--accent)' : 'var(--text-tertiary)',
          borderBottom: activeSection === s.id ? '2px solid var(--accent)' : '2px solid transparent'
        }}>
            {s.label}
          </button>
        )}
      </div>

      <div className="px-5 pb-6">
        {/* Edit form */}
        {editing &&
        <div className="rounded border p-4 my-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
            <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Edit Player Card</p>
            {[
          { placeholder: "Display name", field: "display_name" },
          { placeholder: "Club name", field: "school" },
          { placeholder: "Position", field: "position" },
          // Jersey number appears on the recruiting card — athlete-only.
          ...(isCoach ? [] : [{ placeholder: "Jersey number (optional)", field: "jersey_number" }])].
          map(({ placeholder, field }) =>
          <input key={field} className="w-full rounded px-4 py-3 text-sm font-work outline-none"
          style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
          placeholder={placeholder}
          value={form[field] || ""}
          onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))} />
          )}
            {/* GPA — recruiting signal. Coerced to number so the schema accepts it. */}
            {!isCoach &&
            <input className="w-full rounded px-4 py-3 text-sm font-work outline-none"
            style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
            placeholder="GPA (optional — e.g. 3.7)"
            type="number" step="0.1" min="0" max="5" inputMode="decimal"
            value={form.gpa ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, gpa: e.target.value === "" ? null : Math.min(5, Math.max(0, Number(e.target.value))) }))} />
            }
            {/* App-styled pickers — never native <select> */}
            <ChipSelect label="Sport" options={SPORTS} value={form.sport || ""}
            onChange={(v) => setForm((p) => ({ ...p, sport: v }))} />
            {!isCoach && <ChipSelect label="Grade" options={GRADES} value={form.grade || ""}
            onChange={(v) => setForm((p) => ({ ...p, grade: v }))} />}
            <textarea className="w-full rounded px-4 py-3 text-sm font-work outline-none resize-none h-16"
          style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
          placeholder="Bio" value={form.bio || ""} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded font-elite text-xs uppercase"
            style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>Cancel</button>
              <StampButton onClick={save} disabled={saving} className="flex-1">
                {saving ? "Saving…" : "Save"}
              </StampButton>
            </div>
          </div>
        }

        {activeSection === "stats" &&
        <div className="space-y-3 mt-3">
            {/* Shareable recruiting card — the viral loop. Real data only. */}
            <RecruitingCard athlete={athlete} verifiedFlags={{ weight_lbs: weightVerified }} />
            <HighlightReel athlete={athlete} onUpdate={reload} />
            <div className="grid grid-cols-2 gap-2">
              {[
            { label: "Day Streak", value: athlete.current_streak_days || 0 },
            { label: "OFFSZN Points", value: (athlete.total_points || 0).toLocaleString(), accent: true },
            // Body-comp cells are athlete-only — never on a coach profile
            ...(isCoach ? [] : [
            { label: "Current lbs", value: athlete.weight_lbs || "--" },
            { label: "Goal lbs", value: athlete.goal_weight_lbs || "--" }])].
            map(({ label, value, accent }) =>
            <div key={label} className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: accent ? 'var(--accent)' : 'var(--theme-border)', borderLeftWidth: accent ? 3 : 1 }}>
                  <p className="font-elite text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--theme-ink-soft)' }}>{label}</p>
                  <p className="font-elite text-3xl leading-none" style={{ color: accent ? 'var(--accent)' : 'var(--theme-ink)' }}>{value}</p>
                </div>
            )}
            </div>
            {!isCoach && <StrengthMaxes athlete={athlete} onUpdate={reload} />}
            {!isCoach && <AdvancedStats athlete={athlete} isPremium={isPremium} onUpgrade={() => setShowPaywall(true)} />}
            {athlete.bio &&
          <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
                <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--theme-ink-soft)' }}>Bio</p>
                <p className="font-work text-sm leading-relaxed" style={{ color: 'var(--theme-ink)' }}>{athlete.bio}</p>
              </div>
          }
          </div>
        }

        {activeSection === "badges" && <BadgesSection athlete={athlete} />}

        {activeSection === "locker" &&
        <div className="-mx-5 mt-3">
            <Rewards />
          </div>
        }

        {activeSection === "goals" &&
        <div className="space-y-3 mt-3">
            <MacroRecompute athlete={athlete} onUpdate={(a) => {setAthlete(a);setForm(a);}} />
            <div className="rounded border p-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Macro Goals</p>
              {goalsError && <p className="text-xs" style={{ color: 'var(--negative)' }}>{goalsError}</p>}
              {[
            { label: "Daily Calories", field: "goal_calories", unit: "kcal" },
            { label: "Protein", field: "goal_protein_g", unit: "g" },
            { label: "Carbs", field: "goal_carbs_g", unit: "g" },
            { label: "Fats", field: "goal_fats_g", unit: "g" }].
            map(({ label, field, unit }) =>
            <div key={field} className="flex items-center justify-between">
                  <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{label}</span>
                  <div className="flex items-center gap-2">
                    <input type="number"
                className="w-24 rounded px-3 py-1.5 font-elite text-sm outline-none text-right"
                style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                value={form[field] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [field]: Number(e.target.value) }))}
                onBlur={save} />
                    <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>{unit}</span>
                  </div>
                </div>
            )}
            </div>
            <div className="rounded border p-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Body Goals</p>
              {[
            // No goal-weight field for minors — performance framing only.
            ...(isMinorUser ? [] : [{ label: "Target Weight", field: "goal_weight_lbs", unit: "lbs" }])].
            map(({ label, field, unit }) =>
            <div key={field} className="flex items-center justify-between">
                  <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>{unit}</span>
                    <input type="number"
                className="w-24 rounded px-3 py-1.5 font-elite text-sm outline-none text-right"
                style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                value={form[field] || ""}
                onChange={(e) => setForm((p) => ({ ...p, [field]: Number(e.target.value) }))}
                onBlur={save} />
                  </div>
                </div>
            )}
            {isMinorUser &&
            <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--theme-ink-soft)' }}>
                Body-weight targets unlock at 18. Right now it's about getting stronger and faster — chase the maxes below.
              </p>
            }
            </div>
            {/* Weight-room goals — edit your maxes right from the Goals tab */}
            {!isCoach && <StrengthMaxes athlete={athlete} onUpdate={reload} />}
          </div>
        }

        {activeSection === "coach" && isCoach &&
        <div className="mt-3 space-y-4">
            <CoachPayoutSetup athlete={athlete} onUpdate={(a) => setAthlete(a)} />
            <CoachInbox athlete={athlete} />
            <CoachTier athlete={athlete} onUpdate={reload} />
          </div>
        }

        {activeSection === "settings" &&
        <div className="space-y-4 mt-3">

            {/* Appearance */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Appearance</p>
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="flex items-center gap-3">
                  {darkMode ? <Moon size={15} style={{ color: 'var(--accent)' }} /> : <Sun size={15} style={{ color: 'var(--accent)' }} />}
                  <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>
                    {darkMode ? "Dark Mode" : "Light Mode"}
                  </span>
                </div>
                <button
                onClick={() => setDarkMode((d) => !d)}
                className="w-12 h-6 rounded-full relative transition-all duration-300 flex-shrink-0"
                style={{ background: darkMode ? 'var(--accent)' : '#9BA3AC' }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300"
                style={{ left: darkMode ? '26px' : '2px' }} />
                </button>
              </div>
              <AccentColorPicker />
            </div>

            {/* Notifications */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Notifications</p>
              {[
            { label: "Daily Streak Reminders", key: "streak" },
            { label: "Challenge Updates", key: "challenges" },
            { label: "Clan Activity", key: "clan" }].
            map(({ label, key }) =>
            <div key={key} className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex items-center gap-3">
                      <Bell size={15} style={{ color: 'var(--accent)' }} />
                      <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>{label}</span>
                  </div>
                  <button
                onClick={() => {setNotifications((n) => !n);localStorage.setItem('pb_notifs', notifications ? 'off' : 'on');}}
                className="w-12 h-6 rounded-full relative transition-all duration-300"
                style={{ background: notifications ? 'var(--accent)' : '#9BA3AC' }}>
                    <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300"
                style={{ left: notifications ? '26px' : '2px' }} />
                  </button>
                </div>
            )}
            </div>

            {/* Preferences */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Preferences</p>
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Units</span>
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                  {["imperial", "metric"].map((u) =>
                <button key={u} onClick={() => {setUnits(u);localStorage.setItem('pb_units', u);}}
                className="px-3 py-1 font-elite text-[9px] uppercase tracking-widest transition-all"
                style={{ background: units === u ? 'var(--accent)' : 'transparent', color: units === u ? '#0A0B0D' : 'var(--theme-ink-soft)' }}>
                      {u}
                    </button>
                )}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Profile Privacy</span>
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                  {["public", "private"].map((p) =>
                <button key={p} onClick={() => {setPrivacy(p);localStorage.setItem('pb_privacy', p);}}
                className="px-3 py-1 font-elite text-[9px] uppercase tracking-widest transition-all"
                style={{ background: privacy === p ? 'var(--accent)' : 'transparent', color: privacy === p ? '#0A0B0D' : 'var(--theme-ink-soft)' }}>
                      {p}
                    </button>
                )}
                </div>
              </div>
            </div>

            {/* Manage active subscription — plan, portal, cancel */}
            <ManageSubscription />

            {/* Subscription */}
            {!isPremium &&
          <div className="rounded border-2 p-5 flex items-center justify-between" style={{ borderColor: 'var(--accent)', background: 'var(--theme-surface)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown size={14} style={{ color: 'var(--accent)' }} />
                    <span className="font-anton text-base uppercase" style={{ color: 'var(--theme-ink)' }}>ALL-SZN Pass</span>
                  </div>
                  <p className="font-work text-xs" style={{ color: 'var(--theme-ink-soft)' }}>Unlock the platform. Coach programs sold separately.</p>
                </div>
                <div className="text-right">
                  <p className="font-elite text-xl" style={{ color: 'var(--accent)' }}>$9.99<span style={{ fontSize: 11 }}>/mo</span></p>
                  <StampButton onClick={() => setShowPaywall(true)} className="text-[10px] px-3 py-1 mt-1">Upgrade</StampButton>
                </div>
              </div>
          }

            {/* Points balance */}
            <div className="rounded border p-4 flex items-center justify-between" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: 'var(--accent)' }} />
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Your Points</span>
              </div>
              <span className="font-elite text-xl" style={{ color: 'var(--accent)' }}>{(athlete.total_points || 0).toLocaleString()}</span>
            </div>

            {/* Coach's sticky note */}
            <div className="flex justify-center">
              

            
            </div>

            {/* Scripture */}
            <div className="rounded border p-5 text-center" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-xl mb-2" style={{ color: 'var(--accent)' }}>Proverbs 3:5-6</p>
              <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--theme-ink-soft)', fontStyle: 'italic' }}>
                "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight."
              </p>
              <p className="font-elite text-[8px] uppercase tracking-widest mt-3" style={{ color: '#9BA3AC' }}>Coded with God</p>
            </div>

            {/* Account */}
            {/* Help & Support */}
            <Link to="/help" className="rounded border flex items-center justify-between px-4 py-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-3">
                <HelpCircle size={15} style={{ color: 'var(--accent)' }} />
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Help & Support</span>
              </div>
              <ChevronRight size={14} style={{ color: 'var(--theme-ink-soft)' }} />
            </Link>

            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Account</p>
              <button className="w-full flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}
            onClick={() => {
              // Clear USER state so a second user on this device starts clean.
              // Device-level analytics consent (offszn_analytics_consent) is kept by design.
              ['pb_notifs', 'pb_units', 'pb_privacy', 'pb_accent', 'pb_health_interest'].forEach(k => localStorage.removeItem(k));
              sessionStorage.clear();
              base44.auth.logout('/');
            }}>
                <div className="flex items-center gap-3">
                  <LogOut size={15} style={{ color: 'var(--accent)' }} />
                  <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Sign Out</span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--theme-ink-soft)' }} />
              </button>
            </div>

            {/* Delete account — two-step confirm */}
            <DeleteAccountSection />

            <p className="text-center text-xs pb-2">
              <Link to="/aup" style={{ color: 'var(--text-tertiary)' }}>Acceptable Use Policy</Link>
            </p>

          </div>
        }
      </div>

      <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>);

}