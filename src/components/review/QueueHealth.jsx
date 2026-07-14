// Queue health strip — oldest unreviewed item's age; critical >24h burns red.
import { formatDistanceToNow } from "date-fns";

export default function QueueHealth({ media = [], reports = [] }) {
  const all = [...media, ...reports];
  if (all.length === 0) return (
    <p className="font-elite text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--positive)' }}>
      Queue clear — nothing waiting
    </p>
  );
  const oldest = all.reduce((o, x) => (new Date(x.created_date) < new Date(o.created_date) ? x : o));
  const dayMs = 24 * 60 * 60 * 1000;
  const staleCritical = reports.find(r => r.severity === "critical" && Date.now() - new Date(r.created_date).getTime() > dayMs);
  return (
    <div className="mt-1">
      <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
        Oldest unreviewed: {formatDistanceToNow(new Date(oldest.created_date))} old · {all.length} waiting
      </p>
      {staleCritical && (
        <p className="font-elite text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--negative)' }}>
          ⚠ Critical report older than 24h — review now
        </p>
      )}
    </div>
  );
}