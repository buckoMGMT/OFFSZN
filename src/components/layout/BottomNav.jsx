import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Rss, BarChart2, BookOpen, Shield, User, Clapperboard } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useDock } from "@/lib/DockContext";

/* §1 — Adaptive floating dock: detached rounded pill, translucent blur, safe-area
   aware. Drives its own FULL / COMPACT / HIDDEN transform from DockContext.
   Locker (rewards) lives inside the Player tab — keeps the dock uncluttered. */
const baseTabs = [
  { icon: Rss,       label: "Field",   path: "/" },
  { icon: BarChart2, label: "Stats",   path: "/track" },
  { icon: BookOpen,  label: "Drills",  path: "/drills" },
  { icon: Shield,    label: "Teams",   path: "/clans" },
  { icon: User,      label: "Player",  path: "/profile" },
];

export default function BottomNav() {
  const location = useLocation();
  const [isCoach, setIsCoach] = useState(false);
  const { state, reduced, recover, immersive } = useDock();
  const touchStartY = useRef(null);

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1)
      .then(l => setIsCoach(l[0]?.role === "coach"))
      .catch(() => {});
  }, []);

  const tabs = isCoach
    ? [...baseTabs.slice(0, 4), { icon: Clapperboard, label: "Film", path: "/studio" }, ...baseTabs.slice(4)]
    : baseTabs;

  const compact = state === "COMPACT";
  const hidden = state === "HIDDEN";

  // Swipe UP from the bottom edge recovers the dock (works in HIDDEN/immersive)
  useEffect(() => {
    const onStart = (e) => {
      const y = e.touches?.[0]?.clientY;
      if (y != null && y > window.innerHeight - 40) touchStartY.current = y;
      else touchStartY.current = null;
    };
    const onEnd = (e) => {
      if (touchStartY.current == null) return;
      const endY = e.changedTouches?.[0]?.clientY ?? touchStartY.current;
      if (touchStartY.current - endY > 40) recover();
      touchStartY.current = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [recover]);

  const transition = reduced
    ? "none"
    : "transform 200ms var(--ease-out), opacity 200ms var(--ease-out)";

  // HIDDEN → fully off-screen below the edge. COMPACT → ~70% scale.
  const translateY = hidden ? "calc(100% + env(safe-area-inset-bottom) + 24px)" : "0";
  const scale = compact ? 0.82 : 1;

  return (
    <>
      {/* Slim grab indicator — hints the swipe-up recovery when dock is away */}
      {(hidden || immersive) && (
        <button
          onClick={recover}
          aria-label="Show navigation"
          className="fixed left-1/2 z-50"
          style={{
            bottom: "calc(6px + env(safe-area-inset-bottom))",
            transform: "translateX(-50%)",
            width: 44, height: 4, borderRadius: "var(--r-full)",
            background: "var(--border-strong)", border: "none",
            transition,
          }}
        />
      )}

      <nav
        className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{
          bottom: "calc(10px + env(safe-area-inset-bottom))",
          transform: `translateY(${translateY})`,
          transition,
        }}
      >
        <div
          className="flex items-stretch pointer-events-auto"
          style={{
            gap: compact ? 2 : 4,
            padding: compact ? "5px 7px" : "7px 10px",
            borderRadius: "var(--r-full)",
            background: "color-mix(in srgb, var(--surface-1) 88%, transparent)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 28px rgba(0,0,0,0.4)",
            transformOrigin: "bottom center",
            transform: `scale(${scale})`,
            transition,
          }}
        >
          {tabs.map(({ icon: Icon, label, path }) => {
            const active = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center justify-center relative"
                style={{
                  minWidth: compact ? 44 : 52,
                  minHeight: 44,
                  gap: compact ? 0 : 2,
                  padding: compact ? "0 6px" : "4px 10px",
                  borderRadius: "var(--r-full)",
                  background: active ? "var(--accent-subtle)" : "transparent",
                  color: active ? "var(--accent)" : "var(--text-tertiary)",
                  transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
                }}
              >
                <Icon size={compact ? 20 : 21} strokeWidth={active ? 2.25 : 1.75} color="currentColor" />
                {!compact && (
                  <span style={{ fontSize: "9px", fontFamily: "Inter, sans-serif", fontWeight: active ? 600 : 500, letterSpacing: "0.01em", lineHeight: 1 }}>
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}