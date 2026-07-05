// The Scout's Report — weight trend + 6-month projected peak.
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { projectTrend } from "@/lib/statEngine";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { format } from "date-fns";

export default function ProjectedPeak({ athlete }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    base44.entities.ProgressEntry.filter({ athlete_id: athlete.id }, "date", 60).then(setEntries);
  }, [athlete.id]);

  if (!entries) return <div className="skeleton h-40 rounded-lg" />;

  const points = entries.filter(e => e.weight_lbs).map(e => ({ date: e.date, value: e.weight_lbs }));
  const projection = projectTrend(points, 6);

  return (
    <div className="card-base p-4">
      <p className="eyebrow mb-1">Projected Peak — Scout's Report</p>
      {points.length < 2 ? (
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Log your weight over a few weeks in Track and we'll forecast where you're headed.</p>
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
            At your current rate you'll hit{" "}
            <span className="tabular-nums font-semibold" style={{ color: 'var(--accent)' }}>{projection?.projectedValue} lbs</span>
            {" "}by {projection && format(projection.futureDate, "MMM yyyy")}
            {athlete.goal_weight_lbs ? ` — goal: ${athlete.goal_weight_lbs} lbs.` : "."}
          </p>
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points.map(p => ({ ...p, label: format(new Date(p.date), "M/d") }))}>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} />
                <YAxis domain={['dataMin - 5', 'dataMax + 5']} tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 11 }} />
                {athlete.goal_weight_lbs && <ReferenceLine y={athlete.goal_weight_lbs} stroke="var(--positive)" strokeDasharray="4 3" />}
                <Area type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} fill="var(--accent-subtle)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}