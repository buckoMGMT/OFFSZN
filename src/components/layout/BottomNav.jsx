import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User, Gift, Clapperboard } from "lucide-react";
import { base44 } from "@/api/base44Client";

/* Floating dock: detached rounded pill, translucent blur, safe-area aware. */
const baseTabs = [
  { icon: Rss,       label: "Field",   path: "/" },
  { icon: BarChart2, label: "Stats",   path: "/track" },
  { icon: BookOpen,  label: "Drills",  path: "/drills" },
  { icon: Shield,    label: "Teams",   path: "/clans" },
  { icon: Gift,      label: "Locker",  path: "/rewards" },
  { icon: User,      label: "Player",  path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();
  const [isCoach, setIsCoach] = useState(false);

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1)
      .then(l => setIsCoach(l[0]?.role === "coach"))
      .catch(() => {});
  }, []);

  // Coaches get the Studio tab; Teams steps aside to keep the dock 6-wide.
  const tabs = isCoach
    ? [...baseTabs.slice(0, 3), { icon: Clapperboard, label: "Studio", path: "/studio" }, ...baseTabs.slice(4)]
    : baseTabs;

  return (
    <nav
      className="fixed left-0 right-0 z-50 px-4 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <div
        className="flex items-stretch justify-around mx-auto pointer-events-auto overlay-shadow"
        style={{
          maxWidth: 420,
          borderRadius: "var(--r-full)",
          background: "color-mix(in srgb, var(--surface-1) 82%, transparent)",
          border: "1px solid var(--border-strong)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          padding: "6px 8px",
        }}
      >
        {tabs.map(({ icon: Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 relative"
              style={{
                minHeight: 48,
                borderRadius: "var(--r-full)",
                background: active ? "var(--accent-subtle)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-tertiary)",
                transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
              }}
            >
              <Icon size={21} strokeWidth={active ? 2.25 : 1.75} color="currentColor" />
              <span
                style={{
                  fontSize: "9px",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.01em",
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