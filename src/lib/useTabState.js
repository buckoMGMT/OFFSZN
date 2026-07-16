// §4 stack preservation — useState that survives tab switches (and remounts)
// by mirroring into sessionStorage. Used for each tab page's inner state
// (active sub-tab, filters) so returning to a tab restores where you left off.
import { useState, useCallback } from "react";

export default function useTabState(key, initial) {
  const storageKey = `tabstate:${key}`;
  const [value, setValue] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) ?? initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((v) => {
    setValue(v);
    try {
      sessionStorage.setItem(storageKey, v);
    } catch { /* storage unavailable — state still works in-memory */ }
  }, [storageKey]);
  return [value, set];
}