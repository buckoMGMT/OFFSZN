// §4 — Sheets participate in back navigation. When a sheet opens we push a
// history entry; a back gesture / Android hardware back / browser back then
// dismisses the SHEET first instead of leaving the screen (or the app).
// Closing the sheet by its own affordance consumes that entry silently.
import { useEffect, useRef } from "react";

export default function useSheetBack(open, onClose) {
  const closedByPop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    closedByPop.current = false;
    window.history.pushState({ offszn_sheet: true }, "");
    const onPop = () => {
      closedByPop.current = true;
      onCloseRef.current?.();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Sheet closed via its own button/backdrop → consume the pushed entry
      if (!closedByPop.current && window.history.state?.offszn_sheet) {
        window.history.back();
      }
    };
  }, [open]);
}