import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User } from "lucide-react";

const tabs = [
  { icon: Rss,      label: "Field",    path: "/",        color: "#D7263D",  textColor: "#fff" },
  { icon: BarChart2,label: "Stats",    path: "/track",   color: "#5E646B",  textColor: "#fff" },
  { icon: BookOpen, label: "Playbook", path: "/playbook",color: "#272729",  textColor: "#9BA3AC" },
  { icon: Shield,   label: "Teams",    path: "/clans",   color: "#1B1B1D",  textColor: "#9BA3AC" },
  { icon: User,     label: "Player",   path: "/profile", color: "#0D0D0F",  textColor: "#9BA3AC" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50" style={{ background: '#0D0D0F', borderTop: '1px solid #5E646B' }}>
      <div className="flex items-end justify-around max-w-lg mx-auto px-1 pt-0 pb-0">
        {tabs.map(({ icon: Icon, label, path, color, textColor }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-end relative"
              style={{ flex: 1 }}
            >
              {/* Binder tab shape */}
              <div
                className="binder-tab w-full flex flex-col items-center justify-center gap-1 py-2.5 transition-all duration-200"
                style={{
                  background: active ? '#EDEEF0' : color,
                  minHeight: active ? 60 : 54,
                  borderLeft: '1px solid #5E646B44',
                  borderRight: '1px solid #5E646B44',
                  borderTop: '1px solid #5E646B',
                }}
              >
                <Icon
                  size={18}
                  strokeWidth={active ? 2 : 1.5}
                  color={active ? '#D7263D' : textColor}
                />
                <span
                  className="font-elite text-[9px] uppercase tracking-widest leading-none"
                  style={{ color: active ? '#D7263D' : textColor }}
                >
                  {label}
                </span>
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full" style={{ background: '#D7263D' }} />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}