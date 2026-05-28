import { Link, useLocation } from "react-router-dom";
import { Home, BarChart2, BookOpen, Trophy, User } from "lucide-react";

const tabs = [
  { icon: Home, label: "Feed", path: "/" },
  { icon: BarChart2, label: "Track", path: "/track" },
  { icon: BookOpen, label: "Playbook", path: "/playbook" },
  { icon: Trophy, label: "Clans", path: "/clans" },
  { icon: User, label: "Profile", path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className={`relative ${active ? "scale-110" : ""} transition-transform duration-200`}>
                {active && (
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-md scale-150" />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} className="relative" />
              </div>
              <span className={`text-[10px] font-barlow font-700 tracking-wide uppercase ${active ? "text-primary" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}