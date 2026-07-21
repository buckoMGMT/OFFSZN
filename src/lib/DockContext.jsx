// §1 — Adaptive Dock state machine.
// States: FULL | COMPACT | HIDDEN.
// Drivers: scroll direction (from AppScroll), idle timer, immersive surfaces,
// on-screen keyboard. Immersive/keyboard force HIDDEN and lock out scroll logic.
// The dock floats over a reserved zone; pages pad by the RESERVED (max) height so
// no state change ever shifts content.
import { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";

const DockContext = createContext(null);

export const DOCK_RESERVED = 96; // px — max dock footprint (FULL pill + margin), reserved always

const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function DockProvider({ children }) {
  const [state, setState] = useState("FULL");       // FULL | COMPACT | HIDDEN
  const [immersive, setImmersive] = useState(0);      // ref-count of open immersive surfaces
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const idleTimer = useRef(null);
  const upSettleTimer = useRef(null);
  const lastScrollY = useRef(0);

  const clearTimers = () => {
    clearTimeout(idleTimer.current);
    clearTimeout(upSettleTimer.current);
  };

  // Idle → COMPACT after 3s with no interaction (only when FULL & not locked)
  const armIdle = useCallback(() => {
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setState(s => (s === "FULL" ? "COMPACT" : s));
    }, 3000);
  }, []);

  // Called by AppScroll on every scroll frame
  const onScroll = useCallback((y) => {
    if (immersive > 0 || keyboardOpen) return;
    const prev = lastScrollY.current;
    lastScrollY.current = y;
    const dy = y - prev;

    if (dy > 4) {
      // Scrolling DOWN → hide
      clearTimeout(upSettleTimer.current);
      clearTimeout(idleTimer.current);
      setState("HIDDEN");
    } else if (dy < -4) {
      // Scrolling UP → COMPACT immediately, FULL after 600ms of no scroll
      setState("COMPACT");
      clearTimeout(upSettleTimer.current);
      upSettleTimer.current = setTimeout(() => {
        setState("FULL");
        armIdle();
      }, 600);
    }
  }, [immersive, keyboardOpen, armIdle]);

  // Any tap / pointer → wake to FULL, re-arm idle
  const wake = useCallback(() => {
    if (immersive > 0 || keyboardOpen) return;
    setState("FULL");
    armIdle();
  }, [immersive, keyboardOpen, armIdle]);

  // Swipe-up-from-bottom recovery out of immersive is handled by consumers
  // calling exitImmersive(); manual recover when immersive is 0:
  const recover = useCallback(() => {
    if (immersive > 0 || keyboardOpen) return;
    setState("FULL");
    armIdle();
  }, [immersive, keyboardOpen, armIdle]);

  const enterImmersive = useCallback(() => setImmersive(n => n + 1), []);
  const exitImmersive = useCallback(() => setImmersive(n => Math.max(0, n - 1)), []);

  // Keyboard detection via VisualViewport — dock hides above a keyboard
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      // Keyboard open when visual viewport shrinks meaningfully vs layout viewport
      const shrink = window.innerHeight - vv.height;
      setKeyboardOpen(shrink > 150);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Arm idle on mount / when leaving locked states
  useEffect(() => {
    if (immersive === 0 && !keyboardOpen) armIdle();
    return clearTimers;
  }, [immersive, keyboardOpen, armIdle]);

  const effectiveState = (immersive > 0 || keyboardOpen) ? "HIDDEN" : state;

  return (
    <DockContext.Provider value={{
      state: effectiveState,
      reduced: prefersReduced(),
      onScroll, wake, recover,
      enterImmersive, exitImmersive,
      immersive: immersive > 0,
    }}>
      {children}
    </DockContext.Provider>
  );
}

export const useDock = () => {
  const ctx = useContext(DockContext);
  if (!ctx) {
    // Safe no-op fallback so components never crash outside the provider
    return {
      state: "FULL", reduced: false,
      onScroll: () => {}, wake: () => {}, recover: () => {},
      enterImmersive: () => {}, exitImmersive: () => {}, immersive: false,
    };
  }
  return ctx;
};

// Hook for immersive surfaces: mount → HIDDEN, unmount → auto-recover.
export function useImmersiveDock(active = true) {
  const { enterImmersive, exitImmersive } = useDock();
  useEffect(() => {
    if (!active) return;
    enterImmersive();
    return exitImmersive;
  }, [active, enterImmersive, exitImmersive]);
}