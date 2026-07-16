// §3 — In-app, controlled pull-to-refresh. The browser's own refresh is
// already blocked by overscroll-behavior (§1); this adds the native-feeling
// replacement: drag down from the top of the nearest .app-scroll container
// past ~70px → branded indicator → re-run the view's data query.
import { useRef, useState } from "react";

const THRESHOLD = 70;
const MAX_PULL = 110;

export default function PullToRefresh({ onRefresh, children }) {
  const wrapRef = useRef(null);
  const startY = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scroller = () => wrapRef.current?.closest(".app-scroll");

  const onTouchStart = (e) => {
    const s = scroller();
    startY.current = s && s.scrollTop <= 0 && !refreshing ? e.touches[0].clientY : null;
  };

  const onTouchMove = (e) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    const s = scroller();
    if (dy > 0 && s && s.scrollTop <= 0) setPull(Math.min(dy * 0.5, MAX_PULL));
    else if (pull !== 0) setPull(0);
  };

  const onTouchEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(0);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    } else {
      setPull(0);
    }
  };

  const armed = pull >= THRESHOLD;
  const showIndicator = pull > 8 || refreshing;

  return (
    <div
      ref={wrapRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      {/* Branded refresh indicator — skeleton bar + eyebrow, never a browser spinner */}
      <div
        aria-hidden={!showIndicator}
        style={{
          height: refreshing ? 44 : pull * 0.55,
          overflow: "hidden",
          transition: startY.current === null && !reduceMotion ? "height var(--dur-base) var(--ease-out)" : "none",
        }}
      >
        <div className="flex flex-col items-center justify-end h-full pb-2" style={{ gap: 6 }}>
          <div
            className={refreshing ? "skeleton" : ""}
            style={{
              width: refreshing ? 96 : Math.max(24, pull),
              height: 4,
              borderRadius: "var(--r-full)",
              background: refreshing ? undefined : armed ? "var(--accent)" : "var(--surface-3)",
              transition: reduceMotion ? "none" : "background var(--dur-fast) var(--ease-out)",
            }}
          />
          <span className="eyebrow" style={{ fontSize: 9, color: armed || refreshing ? "var(--accent)" : "var(--text-tertiary)" }}>
            {refreshing ? "Refreshing" : armed ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}