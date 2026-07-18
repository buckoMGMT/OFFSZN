// Queue health strip — unmissable counter: n waiting + age of oldest item.
// Neutral <12h, --warning past 12h, --negative past 24h. Critical reports
// older than 24h get their own burn line.
export default function QueueHealth({ media = [], reports = [] }) {
  const all = [...media, ...reports];
  if (all.length === 0) return (
    <p className="font-elite text-[9px] uppercase tracking-widest mt-1" style={{ color: 'var(--positive)' }}>
      Queue clear — nothing waiting
    </p>
  );
  const oldest = all.reduce((o, x) => (new Date(x.created_date) < new Date(o.created_date) ? x : o));
  const hours = Math.floor((Date.now() - new Date(oldest.created_date).getTime()) / 3.6e6);
  const color = hours >= 24 ? 'var(--negative)' : hours >= 12 ? 'var(--warning)' : 'var(--text-secondary)';
  const dayMs = 24 * 60 * 60 * 1000;
  const staleCritical = reports.find(r => r.severity === "critical" && Date.now() - new Date(r.created_date).getTime() > dayMs);
  return (
    <div className="mt-2 rounded-lg border px-3 py-2" style={{ borderColor: color, background: 'var(--surface-1)' }}>
      <p className="font-work text-sm font-semibold tabular-nums" style={{ color }}>
        {all.length} item{all.length === 1 ? "" : "s"} waiting — oldest {hours < 1 ? "under an hour" : `${hours}h`}
      </p>
      {staleCritical && (
        <p className="font-elite text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--negative)' }}>
          Critical report older than 24h — review now
        </p>
      )}
    </div>
  );
}