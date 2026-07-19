import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// Every tab is a place. Environment art lives on --surface-0, fixed, behind
// content. CSS gradients + inline SVG line work ONLY. Opacity ceiling 5%.
// Stadium light wash is the single warm light source — same recipe every tab.
const ENV = {
  "/": "field",
  "/track": "film",
  "/drills": "chalk",
  "/playbook": "chalk",
  "/clans": "sideline",
  "/studio": "filmroom",
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

      {/* Depth vignette — pulls the eye to content, darkens the far edges */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 120% 80% at 50% 40%, transparent 58%, rgba(0,0,0,0.35) 100%)" }} />

      {/* THE FIELD — real gridiron: yard lines, hash marks, yard numbers, sideline */}
      {env === "field" && (
        <>
          <div ref={fieldRef} style={{ position: "absolute", inset: 0 }}>
            <svg width="100%" height="100%" viewBox="0 0 480 900" preserveAspectRatio="xMidYMin slice" style={{ position: "absolute", inset: 0, opacity: 0.09 }}>
              <g stroke="rgb(120,220,150)" fill="none">
                {/* Sidelines */}
                <line x1="14" y1="0" x2="14" y2="900" strokeWidth="3" />
                <line x1="466" y1="0" x2="466" y2="900" strokeWidth="3" />
                {/* Yard lines every 90px */}
                {[90, 180, 270, 360, 450, 540, 630, 720, 810].map(y => (
                  <line key={y} x1="14" y1={y} x2="466" y2={y} strokeWidth={y === 450 ? 3 : 1.5} />
                ))}
                {/* Hash marks between yard lines — two inner columns */}
                {Array.from({ length: 45 }).map((_, i) => {
                  const y = 18 + i * 20;
                  return (
                    <g key={i}>
                      <line x1="176" y1={y} x2="192" y2={y} strokeWidth="1.5" />
                      <line x1="288" y1={y} x2="304" y2={y} strokeWidth="1.5" />
                    </g>
                  );
                })}
                {/* Short ticks along both sidelines */}
                {Array.from({ length: 45 }).map((_, i) => {
                  const y = 18 + i * 20;
                  return (
                    <g key={`t${i}`}>
                      <line x1="14" y1={y} x2="26" y2={y} strokeWidth="1" />
                      <line x1="454" y1={y} x2="466" y2={y} strokeWidth="1" />
                    </g>
                  );
                })}
              </g>
              {/* Yard numbers — rotated like real field paint */}
              <g fill="rgb(120,220,150)" fontFamily="'Archivo Black', sans-serif" fontSize="34">
                {[[90, "1 0"], [180, "2 0"], [270, "3 0"], [360, "4 0"], [450, "5 0"], [540, "4 0"], [630, "3 0"], [720, "2 0"]].map(([y, n], i) => (
                  <g key={i}>
                    <text x="52" y={y + 12} transform={`rotate(90 52 ${y})`} textAnchor="middle">{n}</text>
                    <text x="428" y={y + 12} transform={`rotate(-90 428 ${y})`} textAnchor="middle">{n}</text>
                  </g>
                ))}
              </g>
              {/* Directional arrows next to numbers */}
              <g fill="rgb(120,220,150)">
                {[90, 180, 270, 360].map(y => <polygon key={`a${y}`} points={`52,${y - 34} 46,${y - 24} 58,${y - 24}`} />)}
                {[540, 630, 720].map(y => <polygon key={`b${y}`} points={`52,${y + 34} 46,${y + 24} 58,${y + 24}`} />)}
              </g>
            </svg>
          </div>
        </>
      )}

      {/* FILM / STATS — combine-sheet graph paper */}
      {env === "film" && <div className="env-film" style={{ position: "absolute", inset: 0 }} />}

      {/* FILM ROOM — projector screen, tape reels, seat rows, playback bar */}
      {env === "filmroom" && (
        <>
          {/* Warm projector cone from top */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 40% at 50% 8%, rgba(255,90,31,0.10), transparent 62%)" }} />
          <svg width="100%" height="100%" viewBox="0 0 480 900" preserveAspectRatio="xMidYMin slice" style={{ position: "absolute", inset: 0, opacity: 0.09 }}>
            <g stroke="rgb(245,245,240)" fill="none" strokeWidth="2">
              {/* Big projector screen */}
              <rect x="60" y="70" width="360" height="210" rx="6" />
              <line x1="60" y1="112" x2="420" y2="112" strokeWidth="1" />
              {/* Grid overlay on screen — like frozen game tape */}
              {[150, 240, 330].map(x => <line key={`v${x}`} x1={x} y1="112" x2={x} y2="280" strokeWidth="0.75" />)}
              {[160, 210].map(y => <line key={`h${y}`} x1="60" y1={y} x2="420" y2={y} strokeWidth="0.75" />)}
              {/* Play triangle center-screen */}
              <polygon points="228,180 228,220 262,200" fill="rgb(245,245,240)" stroke="none" />
              {/* Two film reels flanking the screen */}
              {[[30, 360], [450, 360]].map(([cx, cy], i) => (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="26" />
                  <circle cx={cx} cy={cy} r="6" />
                  {[0, 60, 120, 180, 240, 300].map(a => {
                    const r = (a * Math.PI) / 180;
                    return <circle key={a} cx={cx + Math.cos(r) * 15} cy={cy + Math.sin(r) * 15} r="4" />;
                  })}
                </g>
              ))}
              {/* Playback scrub bar under the screen */}
              <line x1="70" y1="310" x2="410" y2="310" strokeWidth="3" />
              <circle cx="180" cy="310" r="7" fill="rgb(255,90,31)" stroke="none" />
              {/* Rows of theater seats */}
              {[430, 500, 570].map((y, row) => (
                <g key={row}>
                  {[70, 150, 230, 310, 390].map(x => (
                    <path key={x} d={`M${x} ${y} q0 -14 18 -14 q18 0 18 14 l0 22 l-36 0 z`} strokeWidth="1.5" />
                  ))}
                </g>
              ))}
            </g>
          </svg>
        </>
      )}

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

      {/* LOCKER — a real bank of lockers: doors, vents, handles, name plates, bench */}
      {env === "locker" && (
        <svg width="100%" height="100%" viewBox="0 0 480 900" preserveAspectRatio="xMidYMin slice" style={{ position: "absolute", inset: 0, opacity: 0.085 }}>
          <g stroke="rgb(200,205,212)" fill="none" strokeWidth="1.5">
            {/* Locker bank — 4 doors */}
            {[20, 135, 250, 365].map((x, i) => (
              <g key={i}>
                {/* Door frame */}
                <rect x={x} y="40" width="95" height="440" rx="4" strokeWidth="2" />
                {/* Name plate slot */}
                <rect x={x + 22} y="58" width="51" height="16" rx="2" />
                {/* Vent slats — top */}
                {[92, 102, 112, 122].map(y => (
                  <line key={y} x1={x + 18} y1={y} x2={x + 77} y2={y} />
                ))}
                {/* Handle + latch */}
                <rect x={x + 68} y="240" width="10" height="34" rx="3" strokeWidth="2" />
                <circle cx={x + 73} cy="292" r="4" />
                {/* Vent slats — bottom */}
                {[408, 418, 428, 438].map(y => (
                  <line key={y} x1={x + 18} y1={y} x2={x + 77} y2={y} />
                ))}
              </g>
            ))}
            {/* Floor line */}
            <line x1="0" y1="500" x2="480" y2="500" strokeWidth="2" />
            {/* Bench in front of the lockers */}
            <rect x="70" y="560" width="340" height="14" rx="4" strokeWidth="2" />
            <line x1="100" y1="574" x2="100" y2="640" strokeWidth="2" />
            <line x1="380" y1="574" x2="380" y2="640" strokeWidth="2" />
            <line x1="84" y1="640" x2="116" y2="640" strokeWidth="2" />
            <line x1="364" y1="640" x2="396" y2="640" strokeWidth="2" />
          </g>
        </svg>
      )}

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