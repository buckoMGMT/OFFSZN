import { Flame } from "lucide-react";

export default function StreakBadge({ days }) {
  return (
    <div className="flex items-center gap-1.5 bg-orange-500/15 border border-orange-500/30 rounded-full px-3 py-1">
      <Flame size={14} className="text-orange-400" />
      <span className="text-orange-400 text-xs font-barlow font-bold uppercase tracking-wider">
        {days} Day Streak
      </span>
    </div>
  );
}