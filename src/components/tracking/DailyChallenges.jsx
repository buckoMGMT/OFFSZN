import { CheckCircle, Circle, Zap } from "lucide-react";

function getChallenge(log, athlete) {
  const waterGoal = 80;
  const calGoal = athlete?.goal_calories || 2500;
  const proteinGoal = athlete?.goal_protein_g || 150;

  return [
    {
      id: "water",
      label: "Drink 80oz of water",
      desc: `${log?.water_oz || 0}/80 oz`,
      done: (log?.water_oz || 0) >= waterGoal,
      points: 10,
      tier: "Bronze",
    },
    {
      id: "calories",
      label: "Hit your calorie goal",
      desc: `${Math.round(log?.calories_consumed || 0)}/${calGoal} kcal`,
      done: (log?.calories_consumed || 0) >= calGoal * 0.9,
      points: 20,
      tier: "Silver",
    },
    {
      id: "protein",
      label: "Hit protein target",
      desc: `${Math.round(log?.protein_g || 0)}/${proteinGoal}g protein`,
      done: (log?.protein_g || 0) >= proteinGoal * 0.9,
      points: 15,
      tier: "Silver",
    },
    {
      id: "workout",
      label: "Complete your workout",
      desc: log?.workout_complete ? "Done!" : "Not yet",
      done: !!log?.workout_complete,
      points: 25,
      tier: "Gold",
    },
    {
      id: "sleep",
      label: "Log 8 hours of sleep",
      desc: log?.sleep_hours ? `${log.sleep_hours} hrs logged` : "Not logged",
      done: (log?.sleep_hours || 0) >= 8,
      points: 15,
      tier: "Silver",
    },
  ];
}

export default function DailyChallenges({ log, athlete }) {
  const challenges = getChallenge(log, athlete);
  const completed = challenges.filter(c => c.done).length;
  const totalPoints = challenges.filter(c => c.done).reduce((sum, c) => sum + c.points, 0);

  return (
    <div className="gradient-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-primary" />
          <h3 className="text-sm font-barlow font-bold text-foreground uppercase">Daily Challenges</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-primary font-barlow font-bold">+{totalPoints} pts</span>
          <span className="text-xs text-muted-foreground font-barlow">{completed}/{challenges.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-secondary rounded-full mb-4 overflow-hidden">
        <div
          className="h-full gradient-gold rounded-full transition-all duration-500"
          style={{ width: `${(completed / challenges.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {challenges.map(c => (
          <div key={c.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${c.done ? "bg-primary/10" : "bg-secondary/40"}`}>
            {c.done
              ? <CheckCircle size={18} className="text-primary flex-shrink-0" />
              : <Circle size={18} className="text-muted-foreground flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-barlow font-bold uppercase ${c.done ? "text-primary line-through" : "text-foreground"}`}>
                {c.label}
              </p>
              <p className="text-[10px] text-muted-foreground">{c.desc}</p>
            </div>
            <span className={`text-[10px] font-barlow font-bold px-2 py-0.5 rounded-full ${c.done ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
              +{c.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}