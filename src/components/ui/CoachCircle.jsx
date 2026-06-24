// Red hand-drawn oval that animates in around a leaderboard row
// Mimics a coach circling a name in red marker
export default function CoachCircle() {
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      viewBox="0 0 300 56"
      preserveAspectRatio="none"
      fill="none"
    >
      <ellipse
        cx="150" cy="28" rx="144" ry="24"
        stroke="#D7263D"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        className="coach-circle"
        style={{ filter: 'url(#roughen)' }}
      />
      <defs>
        <filter id="roughen">
          <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" />
        </filter>
      </defs>
    </svg>
  );
}