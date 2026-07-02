import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User, Gift } from "lucide-react";

/* Icon size 24px, stroke 1.75 per spec §8 */
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
    /* Surface-2 nav, hairline top border, no heavy shadow — elevation from ladder.
       Backdrop blur where supported for depth without opaque occlusion.
       Psychology: Fitts's law — primary actions in thumb zone. */
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'var(--surface-2)',
        borderTop: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-stretch justify-around max-w-lg mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-1 flex-1 py-3 relative"
              style={{
                minHeight: 56,
                color: active ? 'var(--accent)' : 'var(--text-tertiary)',
                transition: 'color var(--dur-fast) var(--ease-out)',
              }}
            >
              {/* Von Restorff: active tab is the only orange element in the nav */}
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                  style={{
                    width: 32,
                    height: 3,
                    background: 'var(--accent)',
                    borderRadius: '0 0 var(--r-sm) var(--r-sm)',
                  }}
                />
              )}
              <Icon
                size={22}
                strokeWidth={active ? 2 : 1.75}
                color="currentColor"
              />
              <span
                style={{
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
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