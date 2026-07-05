import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Every tab is a place. Environment art lives on --surface-0, fixed, behind
// content. CSS gradients + inline SVG line work ONLY. Opacity ceiling 5%.
// Stadium light wash is the single warm light source — same recipe every tab.
const ENV = {
  "/": "field",
  "/track": "film",
  "/playbook": "chalk",
  "/clans": "sideline",
  "/rewards": "locker",
  "/profile": "rafters",
};

export default function EnvironmentLayer() {
  const { pathname } = useLocation();
  const env = ENV[pathname] || "field";
  const fieldRef = useRef(null);

  // Gentle 0.3× parallax on the field yard lines; reduced-motion safe.
  useEffect(() => {
    if (env !== "field") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (fieldRef.current) {
          fieldRef.current.style.backgroundPositionY = `${window.scrollY * 0.3}px`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [env]);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        top: 0, bottom: 0,
        width: "100%",
        maxWidth: 480,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Stadium light wash — one warm light source, every tab */}
      <div className="stadium-light" style={{ position: "absolute", inset: 0 }} />

      {/* THE FIELD — turf at night */}
      {env === "field" && (
        <>
          <div ref={fieldRef} className="env-field" style={{ position: "absolute", inset: 0 }} />
          {/* 50-yard line: brighter line behind the header */}
          <div style={{ position: "absolute", left: 0, right: 0, top: 152, height: 1, background: "rgba(245,245,240,0.05)" }} />
          {/* hash marks row along the top */}
          <svg width="100%" height="14" viewBox="0 0 480 14" preserveAspectRatio="none" style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: 0.04 }}>
            {Array.from({ length: 24 }).map((_, i) => (
              <line key={i} x1={i * 20 + 8} y1="0" x2={i * 20 + 8} y2="8" stroke="rgb(245,245,240)" strokeWidth="1.5" />
            ))}
          </svg>
        </>
      )}

      {/* FILM ROOM — combine sheet graph paper */}
      {env === "film" && <div className="env-film" style={{ position: "absolute", inset: 0 }} />}

      {/* CHALK TALK — sparse X's, O's, route arrows */}
      {env === "chalk" && (
        <svg width="100%" height="100%" viewBox="0 0 480 800" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, opacity: 0.04 }}>
          <g stroke="rgb(245,245,240)" strokeWidth="1.5" fill="none">
            <circle cx="60" cy="180" r="10" />
            <circle cx="400" cy="120" r="10" />
            <g transform="rotate(8 140 360)"><line x1="132" y1="350" x2="148" y2="370" /><line x1="148" y1="350" x2="132" y2="370" /></g>
            <g transform="rotate(-6 320 420)"><line x1="312" y1="412" x2="328" y2="428" /><line x1="328" y1="412" x2="312" y2="428" /></g>
            <path d="M70 600 L70 540 Q70 520 90 520" />
            <path d="M410 640 L410 580" />
            <circle cx="250" cy="700" r="10" />
          </g>
        </svg>
      )}

      {/* SIDELINE — bench line + jersey-number ghosts */}
      {env === "sideline" && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 220, height: 1, background: "rgba(245,245,240,0.05)" }} />
          <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-around", alignItems: "flex-start", paddingTop: 170, opacity: 0.03, fontFamily: "'Archivo Black', sans-serif", color: "var(--text-primary)", overflow: "hidden" }}>
            <span style={{ fontSize: 150, lineHeight: 1, transform: "translateX(-24px)" }}>00</span>
            <span style={{ fontSize: 150, lineHeight: 1 }}>07</span>
            <span style={{ fontSize: 150, lineHeight: 1, transform: "translateX(24px)" }}>23</span>
          </div>
        </>
      )}

      {/* LOCKER — vertical vents */}
      {env === "locker" && <div className="env-locker" style={{ position: "absolute", inset: 0 }} />}

      {/* RAFTERS — retired-jersey banner shapes */}
      {env === "rafters" && (
        <svg width="100%" height="100%" viewBox="0 0 480 400" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, opacity: 0.03 }}>
          <rect x="70" y="0" width="26" height="220" rx="6" fill="rgb(245,245,240)" />
          <rect x="210" y="0" width="26" height="260" rx="6" fill="rgb(245,245,240)" />
          <rect x="350" y="0" width="26" height="200" rx="6" fill="rgb(245,245,240)" />
        </svg>
      )}
    </div>
  );
}