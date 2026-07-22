// 1v1 challenge list — offer → accept flow. Incoming offers render an
// Accept / Decline card (24h expiry); active challenges race live scores;
// finals freeze. Rendered inside FriendsSheet.
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Swords, Trophy, Loader2 } from "lucide-react";
import { livePvpScores, resolvePvpIfEnded, respondPvp, pendingExpiresAt } from "@/lib/pvp";

function timeLeft(until) {
  const ms = new Date(until) - new Date();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h left` : `${m}m left`;
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

// Pending offer — incoming gets Accept/Decline, outgoing shows waiting state.
function OfferCard({ ch, incoming, onResponded }) {
  const [busy, setBusy] = useState(false);
  const respond = async (accept) => {
    setBusy(true);
    try {
      await respondPvp(ch.id, accept);
      onResponded();
    } catch {
      setBusy(false);
    }
  };
  return (
    <div className="rounded border p-3" style={{ background: 'var(--surface-1)', borderColor: incoming ? 'var(--accent)' : 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="eyebrow" style={{ color: 'var(--accent)' }}>{incoming ? "Challenge For You" : "Offer Sent"} · 1v1</span>
        <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          Expires {timeLeft(pendingExpiresAt(ch))}
        </span>
      </div>
      <p className="font-work text-sm mb-2" style={{ color: 'var(--text-primary)' }}>
        {incoming
          ? <><span className="font-semibold">{ch.challenger_name}</span> wants to race you — most points in {ch.duration_days} days.</>
          : <>Waiting on <span className="font-semibold">{ch.opponent_name}</span> — most points in {ch.duration_days} days.</>}
      </p>
      {incoming && (
        <div className="flex gap-2">
          <button onClick={() => respond(true)} disabled={busy}
            className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: busy ? 0.6 : 1 }}>
            {busy ? <Loader2 size={12} className="animate-spin inline" /> : "Accept — I'm in"}
          </button>
          <button onClick={() => respond(false)} disabled={busy}
            className="flex-1 py-2 rounded font-elite text-[10px] uppercase tracking-widest"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)', opacity: busy ? 0.6 : 1 }}>
            Decline
          </button>
        </div>
      )}
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
          {done ? (tie ? "Tie" : "Complete") : timeLeft(ch.end_date)}
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
  const [bump, setBump] = useState(0);

  const load = useCallback(async () => {
    const [asChallenger, asOpponent] = await Promise.all([
      base44.entities.PlayerChallenge.filter({ challenger_athlete_id: athlete.id }, "-created_date", 20),
      base44.entities.PlayerChallenge.filter({ opponent_athlete_id: athlete.id }, "-created_date", 20),
    ]);
    const merged = [...asChallenger, ...asOpponent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    // Lazily settle expired offers + ended actives server-side
    const settled = await Promise.all(merged.map(c => resolvePvpIfEnded(c)));
    // Show offers + live + recent finals; drop declined/expired noise
    setChallenges(settled.filter(c => ["pending", "active", "completed"].includes(c.status)).slice(0, 10));
  }, [athlete.id]);

  useEffect(() => { load(); }, [load, refreshKey, bump]);

  if (!challenges || challenges.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      <p className="live-rule">1v1 Challenges</p>
      {challenges.map(c => c.status === "pending"
        ? <OfferCard key={c.id} ch={c} incoming={c.opponent_athlete_id === athlete.id} onResponded={() => setBump(b => b + 1)} />
        : <PvPCard key={c.id} ch={c} myId={athlete.id} />)}
    </div>
  );
}