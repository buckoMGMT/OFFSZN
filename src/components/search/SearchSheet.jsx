// Athlete search — name / school / sport. Empty query shows top athletes by points.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Search } from "lucide-react";
import useSheetBack from "@/lib/useSheetBack";

export default function SearchSheet({ open, onClose, onSelect }) {
  useSheetBack(open, onClose);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(null);

  useEffect(() => {
    if (open && all === null) {
      base44.entities.Athlete.list("-total_points", 100).then(setAll);
    }
  }, [open, all]);

  if (!open) return null;

  const query = q.trim().toLowerCase();
  const results = all === null ? null : query.length >= 2
    ? all.filter(a =>
        (a.display_name || "").toLowerCase().includes(query) ||
        (a.school || "").toLowerCase().includes(query) ||
        (a.sport || "").toLowerCase().includes(query))
    : all.slice(0, 20);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col" style={{ background: 'var(--surface-0)', paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 z-10" style={{ color: 'var(--text-tertiary)' }} />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search athletes, schools, sports…"
            className="input-base" style={{ minHeight: 44, paddingLeft: '2.5rem', fontSize: 16 }} />
        </div>
        <button onClick={onClose} className="p-2 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }} aria-label="Close search">
          <X size={16} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {query.length < 2 && <p className="eyebrow mb-3">Top Athletes</p>}
        {results === null ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ width: '100%', height: 56 }} />)}
          </div>
        ) : results.length === 0 ? (
          <p className="text-sm text-center py-10" style={{ color: 'var(--text-secondary)' }}>
            No athletes match "{q.trim()}". Check the spelling or try a school name.
          </p>
        ) : (
          <div className="space-y-2">
            {results.map(a => (
              <button key={a.id} onClick={() => onSelect(a)} className="card-tappable w-full flex items-center gap-3 p-3 text-left">
                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--surface-3)', border: '1px solid var(--border-subtle)' }}>
                  {a.avatar_url
                    ? <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="font-elite text-xs" style={{ color: 'var(--accent)' }}>{(a.display_name || "A")[0].toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{a.display_name}</p>
                  <p className="font-elite text-[9px] uppercase tracking-widest truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {[a.role === "coach" ? "Coach" : a.sport, a.school].filter(Boolean).join(" · ") || "Athlete"}
                  </p>
                </div>
                <span className="stat-number text-sm" style={{ color: 'var(--accent)' }}>{a.total_points || 0}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}