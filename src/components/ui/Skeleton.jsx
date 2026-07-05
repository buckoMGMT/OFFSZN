/* Skeleton loader — replaces spinners for content areas.
   Perceived speed is a design property (§5, §7 Doherty threshold).
   Blocks match the real layout shape so the content appears to stream in. */

export function SkeletonBlock({ width = "100%", height = 16, radius, className = "" }) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius: radius || 'var(--r-sm)',
        flexShrink: 0,
      }}
    />
  );
}

export function SkeletonCard({ className = "" }) {
  return (
    <div
      className={`card-base p-4 space-y-3 ${className}`}
      style={{ background: 'var(--surface-1)' }}
    >
      <div className="flex items-center gap-3">
        <SkeletonBlock width={40} height={40} radius="var(--r-full)" />
        <div className="flex-1 space-y-2">
          <SkeletonBlock width="60%" height={14} />
          <SkeletonBlock width="40%" height={11} />
        </div>
      </div>
      <SkeletonBlock width="100%" height={12} />
      <SkeletonBlock width="80%" height={12} />
    </div>
  );
}

export function SkeletonFeed() {
  return (
    <div className="space-y-4 px-5 pt-4">
      {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
    </div>
  );
}

export function SkeletonStatGrid() {
  return (
    <div className="px-5 pt-4 space-y-4">
      {/* Hero ring placeholder */}
      <div className="card-base p-5 flex items-center justify-between">
        <div className="space-y-2">
          <SkeletonBlock width={80} height={11} />
          <SkeletonBlock width={120} height={44} />
          <SkeletonBlock width={100} height={11} />
        </div>
        <SkeletonBlock width={110} height={110} radius="var(--r-full)" />
      </div>
      {/* Stat row */}
      <div className="grid grid-cols-3 gap-3">
        {[1,2,3].map(i => (
          <div key={i} className="card-base p-3 space-y-2">
            <SkeletonBlock width="60%" height={10} />
            <SkeletonBlock width="80%" height={28} />
            <SkeletonBlock width="100%" height={6} radius="var(--r-full)" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default SkeletonBlock;