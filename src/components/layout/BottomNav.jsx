import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User, Gift } from "lucide-react";

/* iOS-native tab bar: translucent blur, hairline top border, safe-area aware. */
const tabs = [
  { icon: Rss,       label: "Field",   path: "/" },
  { icon: BarChart2, label: "Stats",   path: "/track" },
  { icon: BookOpen,  label: "Drills",  path: "/playbook" },
  { icon: Shield,    label: "Teams",   path: "/clans" },
  { icon: Gift,      label: "Locker",  path: "/rewards" },
  { icon: User,      label: "Player",  path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'color-mix(in srgb, var(--surface-1) 78%, transparent)',
        borderTop: '1px solid var(--border-strong)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      <div
        className="flex items-stretch justify-around max-w-lg mx-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 relative"
              style={{
                minHeight: 49,
                color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                transition: 'color var(--dur-fast) var(--ease-out)',
              }}
            >
              {active && (
                <span
                  className="absolute top-1 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: 5, height: 5, background: 'var(--accent)' }}
                />
              )}
              <Icon size={24} strokeWidth={active ? 2.25 : 1.75} color="currentColor" />
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: active ? 600 : 500,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}