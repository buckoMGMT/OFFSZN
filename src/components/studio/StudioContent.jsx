// Studio My Content — the coach's drill library with per-drill stats and editing.
import { useState } from "react";
import { Plus, Eye, Bookmark, CheckCircle2, Pencil, Film } from "lucide-react";
import DrillEditSheet from "@/components/studio/DrillEditSheet";

const STATUS_COLOR = { approved: "var(--positive)", pending: "var(--warning)", rejected: "var(--negative)" };

export default function StudioContent({ athlete, drills, onChanged }) {
  const [sort, setSort] = useState("newest");
  const [editing, setEditing] = useState(null); // drill object or "new"

  const sorted = [...drills].sort((a, b) => sort === "views"
    ? (b.view_count || b.views || 0) - (a.view_count || a.views || 0)
    : new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--border-strong)" }}>
          {[["newest", "Newest"], ["views", "Most Viewed"]].map(([v, l]) => (
            <button key={v} onClick={() => setSort(v)}
              className="px-3 py-1.5 font-work text-[10px] font-semibold uppercase"
              style={{ background: sort === v ? "var(--accent)" : "transparent", color: sort === v ? "var(--on-accent)" : "var(--text-secondary)" }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setEditing("new")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded font-elite text-[10px] uppercase tracking-widest"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
          <Plus size={12} /> New Drill
        </button>
      </div>

      {sorted.length === 0 && (
        <div className="card-base p-6 text-center">
          <Film size={20} className="mx-auto mb-2" style={{ color: "var(--accent)" }} />
          <p className="font-work text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Your library starts here.</p>
          <p className="font-work text-xs" style={{ color: "var(--text-secondary)" }}>
            Publish 3 drills to become discoverable and open subscriptions.
          </p>
        </div>
      )}

      {sorted.map(d => (
        <div key={d.id} className="card-base p-3 flex items-center gap-3">
          <div className="w-16 h-11 rounded flex-shrink-0 overflow-hidden flex items-center justify-center"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-subtle)" }}>
            {d.thumbnail_url
              ? <img src={d.thumbnail_url} alt="" className="w-full h-full object-cover" />
              : <Film size={14} style={{ color: "var(--text-tertiary)" }} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-work text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{d.title}</p>
            <p className="font-elite text-[9px] uppercase tracking-wide mt-0.5" style={{ color: STATUS_COLOR[d.status] || "var(--text-tertiary)" }}>
              {d.status}{d.is_free ? " · Free" : " · Subscribers"}
            </p>
            <div className="flex items-center gap-3 mt-1 tabular-nums text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              <span className="flex items-center gap-1"><Eye size={9} /> {d.view_count || d.views || 0}</span>
              <span className="flex items-center gap-1"><Bookmark size={9} /> {d.save_count || 0}</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={9} /> {d.completion_count || 0}</span>
            </div>
          </div>
          <button onClick={() => setEditing(d)} className="p-2 rounded flex-shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)" }}>
            <Pencil size={13} style={{ color: "var(--text-primary)" }} />
          </button>
        </div>
      ))}

      <DrillEditSheet
        open={!!editing}
        drill={editing === "new" ? null : editing}
        athlete={athlete}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged?.(); }}
      />
    </div>
  );
}