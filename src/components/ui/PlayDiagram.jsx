// X's & O's play diagram — used for loading, empty states, onboarding
// Draws routes in on mount like a coach sketching in real time.
import { useEffect, useState } from "react";

export default function PlayDiagram({ size = 180, className = "" }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 80); return () => clearTimeout(t); }, []);

  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className}>
      {/* Line of scrimmage */}
      <line x1="20" y1="110" x2="160" y2="110" stroke="#9BA3AC" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x="162" y="113" fontSize="7" fill="#9BA3AC" fontFamily="Inter, sans-serif">LOS</text>

      {/* O's — offensive line (steel grey) */}
      {[38, 62, 90, 118, 142].map((cx, i) => (
        <circle key={i} cx={cx} cy={110} r="8" stroke="#9BA3AC" strokeWidth="1.5" fill="none" />
      ))}

      {/* X's — defenders (red) */}
      {[50, 90, 130].map((cx, i) => (
        <g key={i}>
          <line x1={cx-6} y1={134} x2={cx+6} y2={146} stroke="var(--accent)" strokeWidth="2" />
          <line x1={cx+6} y1={134} x2={cx-6} y2={146} stroke="var(--accent)" strokeWidth="2" />
        </g>
      ))}

      {/* QB */}
      <circle cx="90" cy="90" r="7" stroke="#9BA3AC" strokeWidth="1.5" fill="none" />

      {/* Routes — draw in on mount */}
      {drawn && <>
        {/* Curl route left */}
        <path d="M38 102 L38 68 Q38 52 54 52 Q68 52 68 66" stroke="var(--accent)" strokeWidth="1.5" fill="none"
          strokeDasharray="200" strokeLinecap="round"
          style={{ animation: 'drawRoute 0.9s ease-out 0.1s both' }} className="draw-route" />
        <polygon points="68,60 64,72 72,70" fill="var(--accent)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.3s 0.9s' }} />

        {/* Fly route right */}
        <path d="M142 102 L142 46" stroke="var(--accent)" strokeWidth="1.5" fill="none"
          strokeDasharray="200" strokeLinecap="round"
          style={{ animation: 'drawRoute 0.7s ease-out 0.3s both' }} className="draw-route" />
        <polygon points="142,40 138,52 146,52" fill="var(--accent)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.3s 0.8s' }} />

        {/* Crossing route */}
        <path d="M62 102 L62 74 L118 74" stroke="var(--accent)" strokeWidth="1.5" fill="none"
          strokeDasharray="200" strokeLinecap="round"
          style={{ animation: 'drawRoute 1s ease-out 0.5s both' }} className="draw-route" />
        <polygon points="124,74 112,70 112,78" fill="var(--accent)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity 0.3s 1.3s' }} />
      </>}
    </svg>
  );
}