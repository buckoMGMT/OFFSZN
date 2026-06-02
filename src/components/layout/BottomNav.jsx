import { Link, useLocation } from "react-router-dom";
import { Home, BarChart2, BookOpen, Trophy, User } from "lucide-react";

const tabs = [
  { icon: Home, label: "Field", path: "/" },
  { icon: BarChart2, label: "Stats", path: "/track" },
  { icon: BookOpen, label: "Playbook", path: "/playbook" },
  { icon: Trophy, label: "Teams", path: "/clans" },
  { icon: User, label: "Player", path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-safe">
      <div className="flex items-center justify-around px-2 py-3 max-w-lg mx-auto">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-1 px-4 py-1 transition-colors duration-150 ${
                active ? "text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className={`text-[10px] font-medium tracking-wide ${active ? "text-primary" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}