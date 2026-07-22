// Full filtered leaderboard — data comes from the leaderboard backend function,
// which enforces the minor-exposure rail server-side. This component never
// queries athletes directly.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, ShieldCheck } from "lucide-react";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse"];
const GRADES = ["freshman", "sophomore", "junior", "senior", "college"];

function FilterRow({ options, value, onChange, allLabel }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
      {["", ...options].map(o => (
        <button key={o || "all"} onClick={() => onChange(o)}
          className="flex-shrink-0 px-3 py-1.5 rounded-full font-elite text-[10px] uppercase tracking-widest"
          style={value === o
            ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent)' }
            : { background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          {o ? o.replace(/_/g, " ") : allLabel}
        </button>
      ))}
    </div>
  );
}

export default function Leaderboard({ athlete }) {
  const [sport, setSport] = useState("");
  const [grade, setGrade] = useState("");
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    const payload = {};
    if (sport) payload.sport = sport;
    if (grade) payload.grade = grade;
    base44.functions.invoke("leaderboard", payload)
      .then(r => setRows(r.data?.rows || []))
      .catch(() => setRows([]));
  }, [sport, grade]);

  const meVisible = rows?.some(r => r.id === athlete?.id);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <FilterRow options={SPORTS} value={sport} onChange={setSport} allLabel="All Sports" />
        <FilterRow options={GRADES} value={grade} onChange={setGrade} allLabel="All Grades" />
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--r-md)' }} />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-14">
          <Trophy size={36} style={{ color: 'var(--text-tertiary)' }} className="mx-auto mb-3" />
          <h3 className="font-anton text-xl uppercase mb-2" style={{ color: 'var(--text-primary)' }}>Board's Open</h3>
          <p className="font-work text-sm max-w-xs mx-auto" style={{ color: 'var(--text-secondary)' }}>
            No ranked athletes match these filters yet. Stack points and claim a spot.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const isMe = r.id === athlete?.id;
            return (
              <div key={r.id} className="flex items-center gap-3 rounded border px-3 py-2.5"
                style={{ background: isMe ? 'var(--accent-subtle)' : 'var(--surface-1)', borderColor: isMe ? 'var(--accent)' : 'var(--border-subtle)' }}>
                <span className="tabular-nums text-sm font-semibold w-6 text-center flex-shrink-0" style={{ color: i < 3 ? 'var(--accent)' : 'var(--text-tertiary)' }}>{i + 1}</span>
                {r.avatar_url
                  ? <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border-strong)' }} />
                  : <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-work text-xs font-semibold" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>{(r.display_name || "?")[0]}</div>}
                <div className="flex-1 min-w-0">
                  <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {r.display_name}{isMe && <span className="ink-stamp ml-2" style={{ fontSize: 8 }}>You</span>}
                  </p>
                  <p className="font-elite text-[9px] uppercase tracking-widest truncate" style={{ color: 'var(--text-tertiary)' }}>
                    {[r.sport?.replace(/_/g, " "), r.position, r.grade].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="tabular-nums text-sm font-semibold flex-shrink-0" style={{ color: 'var(--accent)' }}>{r.total_points.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {rows !== null && athlete && !meVisible && (
        <div className="rounded border p-3 flex items-start gap-2" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}>
          <ShieldCheck size={13} style={{ color: 'var(--positive)', marginTop: 2, flexShrink: 0 }} />
          <p className="font-work text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Not seeing yourself? Athletes under 18 appear on public boards only after a verified guardian approves it. Your points still count everywhere else.
          </p>
        </div>
      )}
    </div>
  );
}