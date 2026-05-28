import { Clock, ChevronRight, Lock } from "lucide-react";
import GoldBadge from "@/components/ui/GoldBadge";

export default function ProgramCard({ program, onClick }) {
  const tagColors = {
    stretch: "text-blue-400",
    fascia: "text-purple-400",
    strength: "text-green-400",
    mobility: "text-orange-400",
    activation: "text-primary",
  };

  return (
    <button
      onClick={onClick}
      className="w-full gradient-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary/40 transition-all duration-200 text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {program.is_premium && (
            <GoldBadge><Lock size={10} />Premium</GoldBadge>
          )}
          <span className="text-xs text-muted-foreground font-barlow uppercase tracking-wide">
            {program.sport} {program.position ? `· ${program.position}` : ""}
          </span>
        </div>
        <h3 className="text-base font-barlow font-bold text-foreground uppercase leading-tight">{program.title}</h3>
        {program.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{program.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock size={12} />
            <span className="text-xs font-barlow">{program.duration_minutes} min</span>
          </div>
          {(program.tags || []).slice(0, 3).map(tag => (
            <span key={tag} className={`text-xs font-barlow uppercase ${tagColors[tag] || "text-muted-foreground"}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <ChevronRight size={20} className="text-muted-foreground flex-shrink-0" />
    </button>
  );
}