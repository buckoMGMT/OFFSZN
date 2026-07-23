// Bottom sheet for sort + filter controls on the Drills explore feed.
import { createPortal } from "react-dom";
import { X, RotateCcw, Star, Sparkles, TrendingUp, ThumbsUp, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";

const SORTS = [
  { id: "featured", label: "Featured", Icon: Star },
  { id: "newest", label: "Newest", Icon: Sparkles },
  { id: "popular", label: "Most Viewed", Icon: TrendingUp },
  { id: "top_rated", label: "Top Rated", Icon: ThumbsUp },
  { id: "price_low", label: "Price: Low to High", Icon: ArrowUpWideNarrow },
  { id: "price_high", label: "Price: High to Low", Icon: ArrowDownWideNarrow },
];
const PRICES = [
  { id: "all", label: "All" },
  { id: "free", label: "Free" },
  { id: "paid", label: "Paid" },
];
const DIFFS = [
  { id: "all", label: "All" },
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full font-elite text-[10px] uppercase tracking-widest"
      style={{
        background: active ? 'var(--accent)' : 'var(--surface-1)',
        color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
        border: active ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
      }}>
      {children}
    </button>
  );
}

export default function SortFilterSheet({ open, onClose, sortBy, setSortBy, priceFilter, setPriceFilter, difficultyFilter, setDifficultyFilter }) {
  if (!open) return null;

  const reset = () => { setSortBy("featured"); setPriceFilter("all"); setDifficultyFilter("all"); };

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r animate-slide-up max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border-subtle)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h2 className="font-anton text-lg uppercase" style={{ color: 'var(--text-primary)' }}>Sort & Filter</h2>
          <div className="flex items-center gap-2">
            <button onClick={reset} className="flex items-center gap-1 px-2.5 py-1.5 rounded font-elite text-[9px] uppercase tracking-widest"
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <RotateCcw size={10} /> Reset
            </button>
            <button onClick={onClose} className="p-1.5 rounded" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-subtle)' }} aria-label="Close">
              <X size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p className="eyebrow mb-2">Sort By</p>
          <div className="space-y-1.5 mb-5">
            {SORTS.map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)}
                className="w-full flex items-center gap-3 p-3 rounded text-left"
                style={{
                  background: sortBy === s.id ? 'var(--accent-subtle)' : 'var(--surface-1)',
                  border: sortBy === s.id ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                }}>
                <s.Icon size={14} style={{ color: sortBy === s.id ? 'var(--accent)' : 'var(--text-tertiary)' }} />
                <span className="flex-1 font-work text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
                {sortBy === s.id && <span style={{ color: 'var(--accent)', fontSize: 13 }}>✓</span>}
              </button>
            ))}
          </div>

          <p className="eyebrow mb-2">Price</p>
          <div className="flex gap-2 mb-5">
            {PRICES.map(p => <Chip key={p.id} active={priceFilter === p.id} onClick={() => setPriceFilter(p.id)}>{p.label}</Chip>)}
          </div>

          <p className="eyebrow mb-2">Difficulty</p>
          <div className="flex flex-wrap gap-2 mb-6">
            {DIFFS.map(d => <Chip key={d.id} active={difficultyFilter === d.id} onClick={() => setDifficultyFilter(d.id)}>{d.label}</Chip>)}
          </div>

          <button onClick={onClose} className="btn-primary w-full">Show Results</button>
        </div>
      </div>
    </div>,
    document.body
  );
}