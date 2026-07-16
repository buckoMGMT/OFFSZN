// §1/§4 — THE single scroll container for the whole app. Body never scrolls.
// Persists scrollTop per route so switching tabs and returning keeps position.
import { useRef, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

const positions = new Map(); // pathname → scrollTop, survives tab switches

export default function AppScroll({ children }) {
  const ref = useRef(null);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = positions.get(pathname) || 0;
    const save = () => positions.set(pathname, el.scrollTop);
    el.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      el.removeEventListener("scroll", save);
    };
  }, [pathname]);

  return (
    <div ref={ref} className="app-scroll">
      {children}
    </div>
  );
}