import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User } from "lucide-react";

const tabs = [
  { icon: Rss, label: "Field", path: "/" },
  { icon: BarChart2, label: "Stats", path: "/track" },
  { icon: BookOpen, label: "Playbook", path: "/playbook" },
  { icon: Shield, label: "Teams", path: "/clans" },
  { icon: User, label: "Player", path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border pb-safe elevation-2">
      <div className="flex items-center justify-around px-1 py-2 max-w-lg mx-auto">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200 relative min-w-[56px]"
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary green-glow" />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 1.5}
                className={`transition-all duration-200 ${active ? "text-primary" : "text-muted-foreground/45"}`}
              />
              <span className={`text-[10px] tracking-wide font-barlow font-bold uppercase transition-all duration-200 ${
                active ? "text-primary" : "text-muted-foreground/45"
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