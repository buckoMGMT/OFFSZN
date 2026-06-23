export default function MacroBar({ label, consumed, goal, color }) {
  const pct = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const over = goal > 0 && consumed > goal;

  const colorMap = {
    protein: "bg-blue-400",
    carbs: "bg-accent",
    fats: "bg-yellow-400",
    calories: "bg-primary",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-muted-foreground font-barlow uppercase tracking-widest">{label}</span>
        <span className={`text-xs font-mono font-semibold tabular-nums ${over ? "text-accent" : "text-foreground"}`}>
          {Math.round(consumed)}
          <span className="text-muted-foreground font-mono text-[10px]">/{goal}{color !== "calories" ? "g" : ""}</span>
        </span>
      </div>
      <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorMap[color] || "bg-primary"} ${over ? "opacity-70" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}