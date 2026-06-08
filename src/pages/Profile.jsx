import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Crown, Edit2, CheckCircle, BookOpen, Camera } from "lucide-react";
import GoldBadge from "@/components/ui/GoldBadge";
import StreakBadge from "@/components/ui/StreakBadge";
import BadgesSection from "@/components/profile/BadgesSection";
import StrengthMaxes from "@/components/profile/StrengthMaxes";
import HighlightReel from "@/components/profile/HighlightReel";
import CoachTier from "@/components/profile/CoachTier";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "tennis", "softball", "cross_country", "other"];
const GRADES = ["freshman", "sophomore", "junior", "senior", "college"];

export default function Profile() {
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState("stats"); // stats | goals | about

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
    setAthlete(a);
    setForm(a);
    setEditing(true);
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  if (!athlete) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <div className="text-6xl mb-6">🏈</div>
        <h1 className="text-3xl font-barlow font-bold text-foreground uppercase mb-2">Welcome to The Playbook</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-xs">Every champion has a playbook. Create your athlete profile to get started.</p>
        <button onClick={createProfile} disabled={saving}
          className="gradient-gold text-primary-foreground px-8 py-4 rounded-2xl font-barlow font-bold uppercase text-lg gold-glow disabled:opacity-50">
          {saving ? "Creating..." : "Build My Profile"}
        </button>
      </div>
    );
  }

  const isPremium = athlete.subscription_tier === "premium";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 pt-14 pb-5 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center overflow-hidden">
              {athlete.avatar_url ? (
                <img src={athlete.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-primary">
                  {(athlete.display_name || "A")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">{athlete.display_name || "Athlete"}</h1>
              <p className="text-xs text-muted-foreground capitalize">
                {[athlete.sport, athlete.position, athlete.grade].filter(Boolean).join(" · ")}
              </p>
              {athlete.school && <p className="text-xs text-muted-foreground">{athlete.school}</p>}
            </div>
          </div>
          <button onClick={() => setEditing(!editing)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-medium">
            <Edit2 size={12} />
            Edit
          </button>
        </div>

        <div className="flex items-center gap-3">
          {athlete.current_streak_days > 0 && <StreakBadge days={athlete.current_streak_days} />}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Trophy size={12} className="text-primary" />
            <span className="font-semibold text-foreground">{athlete.total_points || 0}</span> pts
          </div>
          {isPremium ? (
            <GoldBadge><Crown size={10} />Premium</GoldBadge>
          ) : (
            <button className="text-xs text-primary font-medium">Upgrade</button>
          )}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex border-b border-border px-4">
        {[
          { id: "stats", label: "Stats" },
          { id: "badges", label: "Badges" },
          { id: "goals", label: "Goals" },
          { id: "coach", label: "Coach" },
          { id: "about", label: "About" },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-3 text-xs font-medium transition-colors border-b-2 ${
              activeSection === s.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-6">
        {/* Edit Mode */}
        {editing && (
          <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Edit Profile</h3>
            <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
              placeholder="Display name" value={form.display_name || ""} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} />
            <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
              placeholder="Profile picture URL" value={form.avatar_url || ""} onChange={e => setForm(p => ({ ...p, avatar_url: e.target.value }))} />
            <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
              placeholder="School name" value={form.school || ""} onChange={e => setForm(p => ({ ...p, school: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <select className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
                value={form.sport || ""} onChange={e => setForm(p => ({ ...p, sport: e.target.value }))}>
                <option value="">Sport</option>
                {SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
                value={form.grade || ""} onChange={e => setForm(p => ({ ...p, grade: e.target.value }))}>
                <option value="">Grade</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <input className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none"
              placeholder="Position" value={form.position || ""} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} />
            <textarea className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none h-16"
              placeholder="Bio" value={form.bio || ""} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} />
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-secondary rounded-lg text-sm font-medium text-muted-foreground">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 bg-primary rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-40">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        )}

        {activeSection === "stats" && (
          <div className="space-y-3 mt-3">
            {/* Pinned Highlight */}
            <HighlightReel athlete={athlete} onUpdate={() => {
              base44.entities.Athlete.list("-created_date", 1).then(list => {
                if (list[0]) { setAthlete(list[0]); setForm(list[0]); }
              });
            }} />

            {/* Key Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-3xl font-bold text-foreground">{athlete.current_streak_days || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Day Streak</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-3xl font-bold text-primary">{athlete.total_points || 0}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Total Points</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-3xl font-bold text-foreground">{athlete.weight_lbs || "--"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Current lbs</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-3xl font-bold text-foreground">{athlete.goal_weight_lbs || "--"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Goal lbs</p>
              </div>
            </div>

            {/* Strength Maxes */}
            <StrengthMaxes athlete={athlete} onUpdate={() => {
              base44.entities.Athlete.list("-created_date", 1).then(list => {
                if (list[0]) { setAthlete(list[0]); setForm(list[0]); }
              });
            }} />

            {athlete.bio && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-2">Bio</p>
                <p className="text-sm text-foreground leading-relaxed">{athlete.bio}</p>
              </div>
            )}
          </div>
        )}

        {activeSection === "badges" && <BadgesSection athlete={athlete} />}

        {activeSection === "goals" && (
          <div className="space-y-3">
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Macro Goals</h3>
              {[
                { label: "Daily Calories", field: "goal_calories", unit: "kcal" },
                { label: "Protein", field: "goal_protein_g", unit: "g" },
                { label: "Carbs", field: "goal_carbs_g", unit: "g" },
                { label: "Fats", field: "goal_fats_g", unit: "g" },
              ].map(({ label, field, unit }) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-barlow uppercase tracking-wide">{label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="w-24 bg-secondary rounded-lg px-3 py-1.5 text-sm text-foreground outline-none text-right"
                      value={form[field] || ""}
                      onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
                      onBlur={save}
                    />
                    <span className="text-xs text-muted-foreground">{unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Body Goals</h3>
              {[
                { label: "Target Weight", field: "goal_weight_lbs", unit: "lbs" },
                { label: "Weekly Food Budget", field: "weekly_budget_usd", unit: "$" },
              ].map(({ label, field, unit }) => (
                <div key={field} className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-barlow uppercase tracking-wide">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{unit}</span>
                    <input
                      type="number"
                      className="w-24 bg-secondary rounded-lg px-3 py-1.5 text-sm text-foreground outline-none text-right"
                      value={form[field] || ""}
                      onChange={e => setForm(p => ({ ...p, [field]: Number(e.target.value) }))}
                      onBlur={save}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "coach" && (
          <div className="mt-3">
            <CoachTier athlete={athlete} onUpdate={() => {
              base44.entities.Athlete.list("-created_date", 1).then(list => {
                if (list[0]) { setAthlete(list[0]); setForm(list[0]); }
              });
            }} />
          </div>
        )}

        {activeSection === "about" && (
          <div className="space-y-4">
            {/* About The Playbook */}
            <div className="relative overflow-hidden gradient-card border border-primary/30 rounded-2xl p-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-8 translate-x-8" />
              <BookOpen size={24} className="text-primary mb-3" />
              <h3 className="text-xl font-barlow font-bold text-foreground uppercase mb-2">About The Playbook</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                Growing up, I was super athletic — but limited by poor ankles, bad sleep, and foods that weren't fueling a future athlete. The most limiting thing was the lack of knowledge.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                That led me to college, where I got my minor in Kinesiology and researched everything about how to optimize the body for maximum potential. I played basically every sport — and my numbers in strength, speed, and agility were off the chart.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                But I didn't reach my athletic potential until after high school, where I became a D1 athlete in a matter of months after following this system.
              </p>
              <p className="text-sm font-barlow font-bold text-primary italic">
                "Every athlete can make plays — but what is an athlete without a playbook behind them?"
              </p>
            </div>

            {/* Jamal Adams Endorsement */}
            <div className="gradient-card border border-border rounded-2xl p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Trophy size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-barlow uppercase text-muted-foreground tracking-wider mb-0.5">Backed By</p>
                <p className="text-base font-barlow font-bold text-foreground uppercase">Jamal Adams</p>
                <p className="text-xs text-muted-foreground">NFL Safety · D1 Athlete · Champion</p>
              </div>
            </div>

            {/* Scripture */}
            <div className="gradient-card border border-border rounded-2xl p-5 text-center">
              <p className="text-2xl font-display text-primary gold-text-glow mb-2">Proverbs 3:5-6</p>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight."
              </p>
              <p className="text-[10px] text-muted-foreground mt-3 font-barlow uppercase tracking-widest">Coded with God</p>
            </div>

            {/* Premium CTA */}
            {!isPremium && (
              <div className="gradient-gold rounded-2xl p-6 text-center gold-glow">
                <Crown size={28} className="text-primary-foreground mx-auto mb-3" />
                <h3 className="text-2xl font-barlow font-bold text-primary-foreground uppercase mb-1">Go Premium</h3>
                <p className="text-xs text-primary-foreground/80 mb-4 leading-relaxed">
                  AI food scanner, elite D1 programs, advanced analytics, no ads.
                </p>
                <p className="text-3xl font-barlow font-bold text-primary-foreground mb-4">$9.99<span className="text-sm font-normal">/mo</span></p>
                <button className="w-full bg-primary-foreground text-primary py-3 rounded-xl font-barlow font-bold uppercase text-base">
                  Upgrade Now
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}