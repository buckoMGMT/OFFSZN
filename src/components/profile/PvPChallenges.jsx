// 1v1 challenge list — live scores race over the window, resolves lazily.
// Rendered inside FriendsSheet; creation happens from a friend row there.
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Swords, Trophy } from "lucide-react";
import { livePvpScores, resolvePvpIfEnded } from "@/lib/pvp";

function daysLeft(end) {
  const ms = new Date(end) - new Date();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function Row({ name, score, win, mine }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-work text-sm truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)', maxWidth: '60%' }}>
        {win && <Trophy size={11} style={{ color: 'var(--accent)' }} />}
        {name}{mine && <span className="ink-stamp" style={{ fontSize: 8 }}>You</span>}
      </span>
      <span className="stat-number text-base" style={{ color: win ? 'var(--accent)' : 'var(--text-primary)' }}>{score.toLocaleString()}</span>
    </div>
  );
}

function PvPCard({ ch, myId }) {
  const [scores, setScores] = useState({ challenger: ch.challenger_score || 0, opponent: ch.opponent_score || 0 });

  useEffect(() => {
    if (ch.status === "active") livePvpScores(ch).then(setScores).catch(() => {});
  }, [ch.id, ch.status]);

  const done = ch.status === "completed";
  const cWin = done ? ch.winner_athlete_id === ch.challenger_athlete_id : scores.challenger > scores.opponent;
  const oWin = done ? ch.winner_athlete_id === ch.opponent_athlete_id : scores.opponent > scores.challenger;
  const tie = done && !ch.winner_athlete_id;

  return (
    <div className="rounded border p-3" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="eyebrow" style={{ color: done ? 'var(--text-tertiary)' : 'var(--accent)' }}>{done ? "Final" : "Live"} · 1v1</span>
        <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          {done ? (tie ? "Tie" : "Complete") : daysLeft(ch.end_date)}
        </span>
      </div>
      <Row name={ch.challenger_name} score={scores.challenger} win={cWin && !tie} mine={ch.challenger_athlete_id === myId} />
      <div className="flex items-center gap-2 my-0.5">
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <Swords size={10} style={{ color: 'var(--text-tertiary)' }} />
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </div>
      <Row name={ch.opponent_name} score={scores.opponent} win={oWin && !tie} mine={ch.opponent_athlete_id === myId} />
    </div>
  );
}

export default function PvPChallenges({ athlete, refreshKey }) {
  const [challenges, setChallenges] = useState(null);

  const load = useCallback(async () => {
    const [asChallenger, asOpponent] = await Promise.all([
      base44.entities.PlayerChallenge.filter({ challenger_athlete_id: athlete.id }, "-created_date", 20),
      base44.entities.PlayerChallenge.filter({ opponent_athlete_id: athlete.id }, "-created_date", 20),
    ]);
    const merged = [...asChallenger, ...asOpponent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const resolved = await Promise.all(merged.map(c =>
      c.status === "active" && new Date(c.end_date) <= new Date() ? resolvePvpIfEnded(c) : Promise.resolve(c)
    ));
    setChallenges(resolved.slice(0, 10));
  }, [athlete.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (!challenges || challenges.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      <p className="live-rule">1v1 Challenges</p>
      {challenges.map(c => <PvPCard key={c.id} ch={c} myId={athlete.id} />)}
    </div>
  );
}