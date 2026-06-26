import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Crown, Edit2, Sun, Moon, Bell, Lock, LogOut, ChevronRight, Zap } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import BadgesSection from "@/components/profile/BadgesSection";
import StrengthMaxes from "@/components/profile/StrengthMaxes";
import HighlightReel from "@/components/profile/HighlightReel";
import CoachTier from "@/components/profile/CoachTier";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import PlayDiagram from "@/components/ui/PlayDiagram";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "tennis", "softball", "cross_country", "other"];
const GRADES = ["freshman", "sophomore", "junior", "senior", "college"];

// Chrome foil seal for premium
function ChromeSeal() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="24" stroke="#9BA3AC" strokeWidth="2.5" fill="#DCDEE1" />
      <circle cx="26" cy="26" r="19" stroke="#5E646B" strokeWidth="1" fill="none" strokeDasharray="3 2" />
      <text x="26" y="22" textAnchor="middle" fontFamily="Anton" fontSize="10" fill="#D7263D" letterSpacing="1">TP</text>
      <text x="26" y="31" textAnchor="middle" fontFamily="Special Elite" fontSize="5" fill="#5E646B" letterSpacing="1">PREMIUM</text>
      <text x="26" y="37" textAnchor="middle" fontFamily="Special Elite" fontSize="4" fill="#9BA3AC" letterSpacing="0.5">VERIFIED</text>
    </svg>
  );
}

export default function Profile() {
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("stats");
  const { darkMode, setDarkMode } = useTheme();
  const [notifications, setNotifications] = useState(() => localStorage.getItem('pb_notifs') !== 'off');
  const [units, setUnits] = useState(() => localStorage.getItem('pb_units') || 'imperial');
  const [privacy, setPrivacy] = useState(() => localStorage.getItem('pb_privacy') || 'public');



  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1).then(list => {
      const a = list[0] || null;
      setAthlete(a);
      if (a) setForm(a);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    if (!athlete) return;
    setSaving(true);
    const updated = await base44.entities.Athlete.update(athlete.id, form);
    setAthlete(updated);
    setEditing(false);
    setSaving(false);
  };

  const createProfile = async () => {
    setSaving(true);
    const a = await base44.entities.Athlete.create({ display_name: "Athlete", subscription_tier: "free", current_streak_days: 0, total_points: 0, onboarding_complete: false });
    setAthlete(a); setForm(a); setEditing(true); setSaving(false);
  };

  const reload = () => base44.entities.Athlete.list("-created_date", 1).then(list => { if (list[0]) { setAthlete(list[0]); setForm(list[0]); } });

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen" style={{ background: '#EDEEF0' }}>
      <PlayDiagram size={150} />
      <p className="font-elite text-xs mt-4" style={{ color: '#5A5D63' }}>Loading player card…</p>
    </div>
  );

  if (!athlete) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#EDEEF0' }}>
      <PlayDiagram size={160} />
      <h1 className="font-anton text-3xl uppercase mt-6 mb-2" style={{ color: '#15151A' }}>Welcome to The Playbook</h1>
      <p className="font-work text-sm mb-8 max-w-xs" style={{ color: '#5A5D63' }}>Every champion needs a playbook. Build your player card.</p>
      <StampButton onClick={createProfile} disabled={saving} className="text-base px-8 py-3">
        {saving ? "Creating..." : "Build My Card"}
      </StampButton>
    </div>
  );

  const isPremium = athlete.subscription_tier === "premium";

  const bg = darkMode ? '#0D0D0F' : '#EDEEF0';
  const surface = darkMode ? '#1B1B1D' : '#DCDEE1';
  const headerBg = darkMode ? '#1B1B1D' : '#DCDEE1';
  const ink = darkMode ? '#EDEEF0' : '#15151A';
  const inkSoft = darkMode ? '#9BA3AC' : '#5A5D63';
  const border = darkMode ? '#5E646B' : '#9BA3AC';

  return (
    <div className="min-h-screen" style={{ background: 'var(--theme-bg)', color: 'var(--theme-ink)' }}>
      {/* Player ID card header */}
      <div className="px-4 pt-14 pb-5 border-b" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-surface)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-16 h-16 rounded border-2 flex items-center justify-center overflow-hidden flex-shrink-0" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)' }}>
              {athlete.avatar_url
                ? <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span className="font-anton text-2xl" style={{ color: '#D7263D' }}>{(athlete.display_name || "A")[0].toUpperCase()}</span>
              }
            </div>
            <div>
              <h1 className="font-anton text-xl uppercase leading-tight" style={{ color: 'var(--theme-ink)' }}>{athlete.display_name || "Athlete"}</h1>
              <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>
                {[athlete.sport, athlete.position, athlete.grade].filter(Boolean).join(" · ")}
              </p>
              {athlete.school && <p className="font-work text-xs" style={{ color: 'var(--theme-ink-soft)' }}>{athlete.school}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <PageLabel number={5} />
            <button onClick={() => setEditing(!editing)} className="flex items-center gap-1 px-2.5 py-1.5 rounded font-elite text-[9px] uppercase tracking-widest"
              style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>
              <Edit2 size={10} /> Edit
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
          <div className="flex items-center gap-1.5">
            <Trophy size={12} style={{ color: '#D7263D' }} />
            <span className="font-elite text-sm" style={{ color: 'var(--theme-ink)' }}>{(athlete.total_points || 0).toLocaleString()}</span>
            <span className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>pts</span>
          </div>
          {athlete.current_streak_days > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="font-elite text-sm" style={{ color: '#D7263D' }}>{athlete.current_streak_days}</span>
                <span className="font-elite text-[8px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>day streak</span>
            </div>
          )}
          {isPremium
            ? <div className="ml-auto"><ChromeSeal /></div>
            : <button className="ml-auto font-elite text-[9px] uppercase tracking-widest" style={{ color: '#D7263D' }}>Upgrade →</button>
          }
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b px-4" style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-bg)' }}>
        {[
          { id: "stats", label: "Stats" },
          { id: "badges", label: "Badges" },
          { id: "goals", label: "Goals" },
          { id: "coach", label: "Coach" },
          { id: "settings", label: "Settings" },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className="flex-1 py-3 font-elite text-[9px] uppercase tracking-widest"
            style={{
              color: activeSection === s.id ? '#D7263D' : 'var(--theme-ink-soft)',
              borderBottom: activeSection === s.id ? '2px solid #D7263D' : '2px solid transparent',
            }}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-6">
        {/* Edit form */}
        {editing && (
          <div className="rounded border p-4 my-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
            <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Edit Player Card</p>
            {[
              { placeholder: "Display name", field: "display_name" },
              { placeholder: "Profile picture URL", field: "avatar_url" },
              { placeholder: "School name", field: "school" },
              { placeholder: "Position", field: "position" },
            ].map(({ placeholder, field }) => (
              <input key={field} className="w-full rounded px-4 py-3 text-sm font-work outline-none"
                style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                placeholder={placeholder}
                value={form[field] || ""}
                onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))} />
            ))}
            <div className="grid grid-cols-2 gap-3">
              <select className="rounded px-4 py-3 text-sm font-work outline-none" style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                value={form.sport || ""} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}>
                <option value="">Sport</option>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="rounded px-4 py-3 text-sm font-work outline-none" style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                value={form.grade || ""} onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}>
                <option value="">Grade</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <textarea className="w-full rounded px-4 py-3 text-sm font-work outline-none resize-none h-16"
              style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
              placeholder="Bio" value={form.bio || ""} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-2.5 rounded font-elite text-xs uppercase"
                style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink-soft)' }}>Cancel</button>
              <StampButton onClick={save} disabled={saving} className="flex-1">
                {saving ? "Saving…" : "Save"}
              </StampButton>
            </div>
          </div>
        )}

        {activeSection === "stats" && (
          <div className="space-y-3 mt-3">
            <HighlightReel athlete={athlete} onUpdate={reload} />
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Day Streak", value: athlete.current_streak_days || 0 },
                { label: "Total Points", value: (athlete.total_points || 0).toLocaleString(), accent: true },
                { label: "Current lbs", value: athlete.weight_lbs || "--" },
                { label: "Goal lbs", value: athlete.goal_weight_lbs || "--" },
              ].map(({ label, value, accent }) => (
                <div key={label} className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: accent ? '#D7263D' : 'var(--theme-border)', borderLeftWidth: accent ? 3 : 1 }}>
                  <p className="font-elite text-[8px] uppercase tracking-widest mb-1" style={{ color: 'var(--theme-ink-soft)' }}>{label}</p>
                  <p className="font-elite text-3xl leading-none" style={{ color: accent ? '#D7263D' : 'var(--theme-ink)' }}>{value}</p>
                </div>
              ))}
            </div>
            <StrengthMaxes athlete={athlete} onUpdate={reload} />
            {athlete.bio && (
              <div className="rounded border p-4" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
                <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--theme-ink-soft)' }}>Bio</p>
                <p className="font-work text-sm leading-relaxed" style={{ color: 'var(--theme-ink)' }}>{athlete.bio}</p>
              </div>
            )}
          </div>
        )}

        {activeSection === "badges" && <BadgesSection athlete={athlete} />}

        {activeSection === "goals" && (
          <div className="space-y-3 mt-3">
            <div className="rounded border p-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Macro Goals</p>
              {[
                { label: "Daily Calories", field: "goal_calories", unit: "kcal" },
                { label: "Protein", field: "goal_protein_g", unit: "g" },
                { label: "Carbs", field: "goal_carbs_g", unit: "g" },
                { label: "Fats", field: "goal_fats_g", unit: "g" },
              ].map(({ label, field, unit }) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{label}</span>
                  <div className="flex items-center gap-2">
                    <input type="number"
                      className="w-24 rounded px-3 py-1.5 font-elite text-sm outline-none text-right"
                      style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                      value={form[field] || ""}
                      onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
                      onBlur={save} />
                    <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded border p-4 space-y-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>Body Goals</p>
              {[
                { label: "Target Weight", field: "goal_weight_lbs", unit: "lbs" },
                { label: "Weekly Budget", field: "weekly_budget_usd", unit: "$" },
              ].map(({ label, field, unit }) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="font-elite text-[10px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-elite text-xs" style={{ color: 'var(--theme-ink-soft)' }}>{unit}</span>
                    <input type="number"
                      className="w-24 rounded px-3 py-1.5 font-elite text-sm outline-none text-right"
                      style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
                      value={form[field] || ""}
                      onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
                      onBlur={save} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "coach" && <div className="mt-3"><CoachTier athlete={athlete} onUpdate={reload} /></div>}

        {activeSection === "settings" && (
          <div className="space-y-4 mt-3">

            {/* Appearance */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Appearance</p>
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="flex items-center gap-3">
                  {darkMode ? <Moon size={15} style={{ color: '#D7263D' }} /> : <Sun size={15} style={{ color: '#D7263D' }} />}
                  <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>
                    {darkMode ? "Dark Mode" : "Light Mode"}
                  </span>
                </div>
                <button
                  onClick={() => setDarkMode(d => !d)}
                  className="w-12 h-6 rounded-full relative transition-all duration-300 flex-shrink-0"
                  style={{ background: darkMode ? '#D7263D' : '#9BA3AC' }}>
                  <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300"
                    style={{ left: darkMode ? '26px' : '2px' }} />
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Notifications</p>
              {[
                { label: "Daily Streak Reminders", key: "streak" },
                { label: "Challenge Updates", key: "challenges" },
                { label: "Clan Activity", key: "clan" },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex items-center gap-3">
                      <Bell size={15} style={{ color: '#D7263D' }} />
                      <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>{label}</span>
                  </div>
                  <button
                    onClick={() => { setNotifications(n => !n); localStorage.setItem('pb_notifs', notifications ? 'off' : 'on'); }}
                    className="w-12 h-6 rounded-full relative transition-all duration-300"
                    style={{ background: notifications ? '#D7263D' : '#9BA3AC' }}>
                    <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all duration-300"
                      style={{ left: notifications ? '26px' : '2px' }} />
                  </button>
                </div>
              ))}
            </div>

            {/* Preferences */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Preferences</p>
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Units</span>
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                  {["imperial", "metric"].map(u => (
                    <button key={u} onClick={() => { setUnits(u); localStorage.setItem('pb_units', u); }}
                      className="px-3 py-1 font-elite text-[9px] uppercase tracking-widest transition-all"
                      style={{ background: units === u ? '#D7263D' : 'transparent', color: units === u ? '#fff' : 'var(--theme-ink-soft)' }}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Profile Privacy</span>
                <div className="flex rounded overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                  {["public", "private"].map(p => (
                    <button key={p} onClick={() => { setPrivacy(p); localStorage.setItem('pb_privacy', p); }}
                      className="px-3 py-1 font-elite text-[9px] uppercase tracking-widest transition-all"
                      style={{ background: privacy === p ? '#D7263D' : 'transparent', color: privacy === p ? '#fff' : 'var(--theme-ink-soft)' }}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription */}
            {!isPremium && (
              <div className="rounded border-2 p-5 flex items-center justify-between" style={{ borderColor: '#D7263D', background: 'var(--theme-surface)' }}>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Crown size={14} style={{ color: '#D7263D' }} />
                    <span className="font-anton text-base uppercase" style={{ color: 'var(--theme-ink)' }}>Go Premium</span>
                  </div>
                  <p className="font-work text-xs" style={{ color: 'var(--theme-ink-soft)' }}>Elite programs · Advanced analytics</p>
                </div>
                <div className="text-right">
                  <p className="font-elite text-xl" style={{ color: '#D7263D' }}>$9.99<span style={{ fontSize: 11 }}>/mo</span></p>
                  <StampButton className="text-[10px] px-3 py-1 mt-1">Upgrade</StampButton>
                </div>
              </div>
            )}

            {/* Points balance */}
            <div className="rounded border p-4 flex items-center justify-between" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <div className="flex items-center gap-2">
                <Zap size={14} style={{ color: '#D7263D' }} />
                <span className="font-elite text-xs uppercase tracking-widest" style={{ color: 'var(--theme-ink)' }}>Your Points</span>
              </div>
              <span className="font-elite text-xl" style={{ color: '#D7263D' }}>{(athlete.total_points || 0).toLocaleString()}</span>
            </div>

            {/* Coach's sticky note */}
            <div className="flex justify-center">
              <div className="sticky-note">
                "Every athlete can make plays — but what is an athlete without a playbook?"
              </div>
            </div>

            {/* Scripture */}
            <div className="rounded border p-5 text-center" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-xl mb-2" style={{ color: '#D7263D' }}>Proverbs 3:5-6</p>
              <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--theme-ink-soft)', fontStyle: 'italic' }}>
                "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight."
              </p>
              <p className="font-elite text-[8px] uppercase tracking-widest mt-3" style={{ color: '#9BA3AC' }}>Coded with God</p>
            </div>

            {/* Account */}
            <div className="rounded border overflow-hidden" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
              <p className="font-elite text-[9px] uppercase tracking-widest px-4 pt-3 pb-1" style={{ color: 'var(--theme-ink-soft)' }}>Account</p>
              <button className="w-full flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--theme-border)' }}
                onClick={() => base44.auth.logout('/')}>
                <div className="flex items-center gap-3">
                  <LogOut size={15} style={{ color: '#D7263D' }} />
                  <span className="font-elite text-xs uppercase tracking-widest" style={{ color: '#D7263D' }}>Sign Out</span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--theme-ink-soft)' }} />
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}