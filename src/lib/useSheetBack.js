// §4 — Sheets participate in back navigation. When a sheet opens we push a
// history entry; a back gesture / Android hardware back / browser back then
// dismisses the SHEET first instead of leaving the screen (or the app).
// Closing the sheet by its own affordance consumes that entry silently.
// It ALSO hides the floating dock while the sheet is open (Instagram behavior:
// navigation exists to navigate, not to sit under an open sheet).
import { useEffect, useRef } from "react";
import { useDock } from "@/lib/DockContext";

export default function useSheetBack(open, onClose) {
  const closedByPop = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { enterImmersive, exitImmersive } = useDock();

  // Dock disappears the moment any sheet/popup takes over, returns on close
  useEffect(() => {
    if (!open) return;
    enterImmersive();
    return exitImmersive;
  }, [open, enterImmersive, exitImmersive]);

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