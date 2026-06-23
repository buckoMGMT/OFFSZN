import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User } from "lucide-react";

// Each tab has a themed background texture matching its page identity
const tabs = [
  {
    icon: Rss,
    label: "Field",
    path: "/",
    // Turf-inspired: diagonal grass-cut stripes
    activeBg: "repeating-linear-gradient(135deg, rgba(0,200,83,0.07) 0px, rgba(0,200,83,0.07) 2px, transparent 2px, transparent 10px)",
  },
  {
    icon: BarChart2,
    label: "Stats",
    path: "/track",
    // Track lanes: horizontal bands
    activeBg: "repeating-linear-gradient(0deg, rgba(0,200,83,0.06) 0px, rgba(0,200,83,0.06) 2px, transparent 2px, transparent 12px)",
  },
  {
    icon: BookOpen,
    label: "Playbook",
    path: "/playbook",
    // Notebook lines
    activeBg: "repeating-linear-gradient(180deg, rgba(0,200,83,0.06) 0px, rgba(0,200,83,0.06) 1px, transparent 1px, transparent 8px)",
  },
  {
    icon: Shield,
    label: "Teams",
    path: "/clans",
    // Diamond/court grid
    activeBg: "repeating-linear-gradient(45deg, rgba(0,200,83,0.06) 0px, rgba(0,200,83,0.06) 1px, transparent 1px, transparent 10px)",
  },
  {
    icon: User,
    label: "Player",
    path: "/profile",
    // Radial spotlight
    activeBg: "radial-gradient(ellipse at center, rgba(0,200,83,0.12) 0%, transparent 70%)",
  },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border pb-safe"
      style={{ background: "hsla(211,47%,11%,0.97)", backdropFilter: "blur(16px)" }}>
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {tabs.map(({ icon: Icon, label, path, activeBg }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-1 py-2.5 flex-1 relative overflow-hidden transition-all duration-200"
              style={active ? { background: activeBg } : {}}
            >
              {/* Active top bar */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.5}
                className={`transition-all duration-200 ${active ? "text-primary" : "text-muted-foreground/40"}`}
              />
              <span className={`text-[9px] tracking-widest font-barlow font-black uppercase transition-all duration-200 ${
                active ? "text-primary" : "text-muted-foreground/35"
              }`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}