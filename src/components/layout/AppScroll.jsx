// §1/§4 — THE single scroll container for the whole app. Body never scrolls.
// Persists scrollTop per route so switching tabs and returning keeps position.
import { useRef, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { useDock } from "@/lib/DockContext";

const positions = new Map(); // pathname → scrollTop, survives tab switches

export default function AppScroll({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();
  const { onScroll, wake } = useDock();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = positions.get(pathname) || 0;
    el.scrollTop = target;
    // Content streams in async — briefly retry the restore until the page is
    // tall enough to hold the saved position (only while still at the top).
    let tries = 0;
    const retry = setInterval(() => {
      if (target > 0 && el.scrollTop === 0 && el.scrollHeight > el.clientHeight) el.scrollTop = target;
      if (++tries > 12 || el.scrollTop >= target) clearInterval(retry);
    }, 80);
    const save = () => {
      positions.set(pathname, el.scrollTop);
      onScroll(el.scrollTop); // §1 — drive adaptive dock from the real scroll
    };
    el.addEventListener("scroll", save, { passive: true });
    return () => {
      clearInterval(retry);
      positions.set(pathname, el.scrollTop);
      el.removeEventListener("scroll", save);
    };
  }, [pathname, onScroll]);

  return (
    <div ref={ref} className="app-scroll" onPointerDown={wake}>
      {children}
    </div>
  );
}