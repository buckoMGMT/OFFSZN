export default function MacroBar({ label, consumed, goal, color }) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const colorMap = {
    protein: "bg-blue-400",
    carbs: "bg-orange-400",
    fats: "bg-yellow-400",
    calories: "bg-primary",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground font-barlow uppercase tracking-wide">{label}</span>
        <span className="text-xs font-semibold text-foreground">
          {Math.round(consumed)}<span className="text-muted-foreground">/{goal}g</span>
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color] || "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}