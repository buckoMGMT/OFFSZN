import { Trophy, Flame, Droplets, Moon, Zap, Star, Shield, Heart, Target, Award } from "lucide-react";

const BADGES = [
  { id: "streak_7", icon: Flame, label: "Week Warrior", desc: "7-day streak", color: "text-orange-400", bg: "bg-orange-400/15", border: "border-orange-400/30", check: (a) => (a.current_streak_days || 0) >= 7 },
  { id: "streak_30", icon: Flame, label: "Iron Streak", desc: "30-day streak", color: "text-red-400", bg: "bg-red-400/15", border: "border-red-400/30", check: (a) => (a.current_streak_days || 0) >= 30 },
  { id: "points_500", icon: Trophy, label: "Rising Star", desc: "500 total points", color: "text-primary", bg: "bg-primary/15", border: "border-primary/30", check: (a) => (a.total_points || 0) >= 500 },
  { id: "points_1000", icon: Award, label: "Elite Athlete", desc: "1,000 points", color: "text-yellow-400", bg: "bg-yellow-400/15", border: "border-yellow-400/30", check: (a) => (a.total_points || 0) >= 1000 },
  { id: "premium", icon: Star, label: "All-SZN Pass", desc: "Premium member", color: "text-primary", bg: "bg-primary/15", border: "border-primary/30", check: (a) => a.subscription_tier === "premium" },
  { id: "clan", icon: Shield, label: "Clan Member", desc: "Joined a clan", color: "text-blue-400", bg: "bg-blue-400/15", border: "border-blue-400/30", check: (a) => !!a.clan_id },
  { id: "weight_set", icon: Target, label: "Goal Setter", desc: "Set a weight goal", color: "text-primary", bg: "bg-primary/15", border: "border-primary/30", check: (a) => !!a.goal_weight_lbs },
  { id: "macro_set", icon: Zap, label: "Nutrition Ready", desc: "Set macro goals", color: "text-purple-400", bg: "bg-purple-400/15", border: "border-purple-400/30", check: (a) => !!a.goal_calories },
  { id: "hydration", icon: Droplets, label: "Hydration Hero", desc: "Set hydration habits", color: "text-cyan-400", bg: "bg-cyan-400/15", border: "border-cyan-400/30", check: (a) => (a.total_points || 0) >= 100 },
  { id: "bio", icon: Heart, label: "Story Told", desc: "Wrote a bio", color: "text-pink-400", bg: "bg-pink-400/15", border: "border-pink-400/30", check: (a) => !!a.bio },
  { id: "sleep", icon: Moon, label: "Recovery King", desc: "Premium sleep tracker", color: "text-indigo-400", bg: "bg-indigo-400/15", border: "border-indigo-400/30", check: (a) => (a.current_streak_days || 0) >= 14 },
  { id: "profile_complete", icon: Star, label: "Full OFFSZN", desc: "Complete profile", color: "text-primary", bg: "bg-primary/10", border: "border-primary/20", check: (a) => !!(a.sport && a.school && a.position && a.bio) },
];

export default function BadgesSection({ athlete }) {
  const earned = BADGES.filter(b => b.check(athlete));
  const locked = BADGES.filter(b => !b.check(athlete));

  return (
    <div className="space-y-4">
      {earned.length > 0 && (
        <div>
          <p className="text-xs font-barlow font-bold text-primary uppercase tracking-widest mb-3">
            Earned Badges ({earned.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {earned.map(badge => {
              const Icon = badge.icon;
              return (
                <div key={badge.id} className={`gradient-card border ${badge.border} rounded-2xl p-3 flex flex-col items-center text-center`}>
                  <div className={`w-10 h-10 rounded-xl ${badge.bg} flex items-center justify-center mb-2`}>
                    <Icon size={20} className={badge.color} />
                  </div>
                  <p className={`text-[10px] font-barlow font-bold uppercase ${badge.color} leading-tight`}>{badge.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{badge.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <p className="text-xs font-barlow font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Locked ({locked.length})
          </p>
          <div className="grid grid-cols-3 gap-3">
            {locked.map(badge => {
              const Icon = badge.icon;
              return (
                <div key={badge.id} className="gradient-card border border-border/50 rounded-2xl p-3 flex flex-col items-center text-center opacity-40">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center mb-2">
                    <Icon size={20} className="text-muted-foreground" />
                  </div>
                  <p className="text-[10px] font-barlow font-bold uppercase text-muted-foreground leading-tight">{badge.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{badge.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {earned.length === 0 && (
        <div className="text-center py-8">
          <Trophy size={40} className="text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">Start tracking to earn your first badge.</p>
        </div>
      )}
    </div>
  );
}