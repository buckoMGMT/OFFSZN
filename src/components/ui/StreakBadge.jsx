import { Flame } from "lucide-react";

export default function StreakBadge({ days }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-3 py-1"
      style={{
        background: "var(--accent-subtle)",
        border: "1px solid var(--accent)",
      }}
    >
      <Flame size={14} style={{ color: "var(--accent)" }} />
      <span
        style={{
          color: "var(--accent)",
          fontSize: "var(--text-xs)",
          fontFamily: "'Archivo Black', sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {days} Day Streak
      </span>
    </div>
  );
}