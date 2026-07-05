// Readiness-to-Train index — daily 0-100 score from sleep + training load.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { readinessScore } from "@/lib/statEngine";

export default function ReadinessIndex({ athlete }) {
  const [score, setScore] = useState(undefined);

  useEffect(() => {
    base44.entities.DailyLog.filter({ athlete_id: athlete.id }, "-date", 7)
      .then(logs => setScore(readinessScore(logs)));
  }, [athlete.id]);

  if (score === undefined) return <div className="skeleton h-24 rounded-lg" />;

  const status = score === null ? null : score >= 75 ? "Green light. Push today." : score >= 50 ? "Moderate. Train smart." : "Recovery day. Hit mobility work.";
  const color = score >= 75 ? 'var(--positive)' : score >= 50 ? 'var(--accent)' : 'var(--warning)';
  const circumference = 2 * Math.PI * 26;

  return (
    <div className="card-base p-4 flex items-center gap-4">
      {score === null ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Log sleep and workouts in Track to unlock your daily Readiness score.</p>
      ) : (
        <>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--surface-2)" strokeWidth="5" />
            <circle cx="32" cy="32" r="26" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score / 100)}
              transform="rotate(-90 32 32)" />
            <text x="32" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text-primary)" style={{ fontVariantNumeric: 'tabular-nums' }}>{score}</text>
          </svg>
          <div>
            <p className="eyebrow mb-0.5">Readiness to Train</p>
            <p className="font-work text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{status}</p>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Based on your last 3 days of sleep & training load</p>
          </div>
        </>
      )}
    </div>
  );
}