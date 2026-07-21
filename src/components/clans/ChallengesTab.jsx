// §3 — Real team challenges. Create a head-to-head vs another team, then watch
// live point totals race over the window. Resolves to a winner automatically.
import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Swords, Trophy, X } from "lucide-react";
import StampButton from "@/components/ui/StampButton";
import { createChallenge, liveScores, resolveIfEnded } from "@/lib/challenges";

const DURATIONS = [3, 7, 14];

function daysLeft(end) {
  const ms = new Date(end) - new Date();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

function ScoreRow({ name, score, win, mine }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="font-work text-sm truncate flex items-center gap-1.5" style={{ color: 'var(--text-primary)', maxWidth: '60%' }}>
        {win && <Trophy size={12} style={{ color: 'var(--accent)' }} />}
        {name}{mine && <span className="ink-stamp" style={{ fontSize: 8 }}>You</span>}
      </span>
      <span className="stat-number text-lg" style={{ color: win ? 'var(--accent)' : 'var(--text-primary)' }}>{score.toLocaleString()}</span>
    </div>
  );
}

function ChallengeCard({ ch, myClanId }) {
  const [scores, setScores] = useState({
    challenger: ch.challenger_score || 0,
    opponent: ch.opponent_score || 0,
  });

  useEffect(() => {
    if (ch.status === "active") liveScores(ch).then(setScores).catch(() => {});
  }, [ch.id, ch.status]);

  const done = ch.status === "completed";
  const cWin = done ? ch.winner_clan_id === ch.challenger_clan_id : scores.challenger > scores.opponent;
  const oWin = done ? ch.winner_clan_id === ch.opponent_clan_id : scores.opponent > scores.challenger;
  const tie = done && !ch.winner_clan_id;

  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="eyebrow" style={{ color: done ? 'var(--text-tertiary)' : 'var(--accent)' }}>
          {done ? "Final" : "Live"} · Team Points
        </span>
        <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          {done ? (tie ? "Tie" : "Complete") : daysLeft(ch.end_date)}
        </span>
      </div>
      <ScoreRow name={ch.challenger_clan_name} score={scores.challenger} win={cWin && !tie} mine={ch.challenger_clan_id === myClanId} />
      <div className="flex items-center gap-2 my-1">
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <Swords size={12} style={{ color: 'var(--text-tertiary)' }} />
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
      </div>
      <ScoreRow name={ch.opponent_clan_name} score={scores.opponent} win={oWin && !tie} mine={ch.opponent_clan_id === myClanId} />
    </div>
  );
}

export default function ChallengesTab({ myClan, allClans }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [opponentId, setOpponentId] = useState("");
  const [duration, setDuration] = useState(7);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!myClan) { setLoading(false); return; }
    setLoading(true);
    // All challenges this team is in, either side.
    const [asChallenger, asOpponent] = await Promise.all([
      base44.entities.ClanChallenge.filter({ challenger_clan_id: myClan.id }, "-created_date", 50),
      base44.entities.ClanChallenge.filter({ opponent_clan_id: myClan.id }, "-created_date", 50),
    ]);
    const merged = [...asChallenger, ...asOpponent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    // Lazily resolve any whose window has closed.
    const resolved = await Promise.all(merged.map(c =>
      c.status === "active" && new Date(c.end_date) <= new Date() ? resolveIfEnded(c) : Promise.resolve(c)
    ));
    setChallenges(resolved);
    setLoading(false);
  }, [myClan?.id]);

  useEffect(() => { load(); }, [load]);

  const opponents = allClans.filter(c => c.id !== myClan?.id);
  const hasActive = challenges.some(c => c.status === "active");

  const submit = async () => {
    setError("");
    const opp = opponents.find(c => c.id === opponentId);
    if (!opp) { setError("Pick a team to challenge."); return; }
    // One active challenge per opponent at a time.
    if (challenges.some(c => c.status === "active" &&
      (c.opponent_clan_id === opp.id || c.challenger_clan_id === opp.id))) {
      setError("You already have an active challenge with that team."); return;
    }
    setCreating(true);
    try {
      await createChallenge(myClan, opp, duration);
      setShowCreate(false);
      setOpponentId("");
      await load();
    } catch {
      setError("Couldn't start the challenge — try again.");
    } finally {
      setCreating(false);
    }
  };

  if (!myClan) {
    return (
      <div className="text-center py-16">
        <Swords size={40} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-4" />
        <h3 className="font-anton text-2xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>Team Challenges</h3>
        <p className="font-work text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>Join a team first to challenge rivals head-to-head.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-anton text-xl uppercase" style={{ color: 'var(--text-primary)' }}>Challenges</h3>
          <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>Most points wins</p>
        </div>
        {opponents.length > 0 && (
          <StampButton onClick={() => { setError(""); setShowCreate(true); }}>
            <Swords size={12} /> Send a Challenge
          </StampButton>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton" style={{ height: 120, borderRadius: 'var(--r-lg)' }} />
          <div className="skeleton" style={{ height: 120, borderRadius: 'var(--r-lg)' }} />
        </div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-14">
          <Swords size={36} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-3" />
          <p className="font-work text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
            No challenges yet. Send one and race another team to the most points.
          </p>
          {opponents.length === 0 && (
            <p className="font-elite text-[10px] uppercase tracking-widest mt-3" style={{ color: 'var(--text-tertiary)' }}>
              Waiting on other teams to join.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {hasActive && <p className="live-rule">Active</p>}
          {challenges.filter(c => c.status === "active").map(c => <ChallengeCard key={c.id} ch={c} myClanId={myClan.id} />)}
          {challenges.some(c => c.status === "completed") && <p className="live-rule">History</p>}
          {challenges.filter(c => c.status === "completed").map(c => <ChallengeCard key={c.id} ch={c} myClanId={myClan.id} />)}
        </div>
      )}

      {/* Create sheet */}
      {showCreate && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--surface-0)', borderColor: 'var(--border-strong)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-anton text-2xl uppercase" style={{ color: 'var(--text-primary)' }}>Send a Challenge</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                <X size={16} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            <p className="eyebrow mb-2">Opponent</p>
            <div className="space-y-2 mb-5 max-h-56 overflow-y-auto">
              {opponents.map(c => (
                <button key={c.id} onClick={() => setOpponentId(c.id)}
                  className="w-full flex items-center justify-between px-3 py-3 rounded text-left"
                  style={opponentId === c.id
                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }
                    : { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }}>
                  <span className="font-work text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                  <span className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
                    {(c.member_ids || []).length} · {(c.total_points || 0).toLocaleString()} pts
                  </span>
                </button>
              ))}
            </div>

            <p className="eyebrow mb-2">Duration</p>
            <div className="flex gap-2 mb-5">
              {DURATIONS.map(d => (
                <button key={d} onClick={() => setDuration(d)}
                  className="flex-1 py-3 rounded font-elite text-[10px] uppercase tracking-widest"
                  style={duration === d
                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }
                    : { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  {d} days
                </button>
              ))}
            </div>

            {error && <p className="text-xs text-center mb-3" style={{ color: 'var(--negative)' }}>{error}</p>}
            <button className="btn-primary w-full" onClick={submit} disabled={creating}>
              {creating ? "Starting…" : "Start Challenge"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}