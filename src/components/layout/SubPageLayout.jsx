// Chrome for nested views outside the tab shell (review, AUP, checkout
// results). Gives them the same sticky TopBar — which renders as an
// iOS-style back button on these non-root paths.
import { Outlet } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";

export default function SubPageLayout() {
  return (
    <div className="min-h-screen" style={{ background: "var(--surface-0)" }}>
      <TopBar />
      <Outlet />
    </div>
  );
}