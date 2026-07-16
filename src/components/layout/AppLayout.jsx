import { Outlet } from "react-router-dom";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import EnvironmentLayer from "@/components/environment/EnvironmentLayer";
import CoachSubSuccessToast from "@/components/monetization/CoachSubSuccessToast";
import PastDueBanner from "@/components/monetization/PastDueBanner";

export default function AppLayout() {
  /* iOS-native shell: full-bleed surface, content constrained to phone width,
     safe-area-aware bottom padding so the nav never clips content.
     Environment art is fixed behind content on --surface-0; the content
     container stays transparent so the place reads through the gutters. */
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-0)' }}>
      <EnvironmentLayer />
      <TopBar />
      <CoachSubSuccessToast />
      <div
        className="mx-auto relative"
        style={{
          background: 'transparent',
          color: 'var(--text-primary)',
          minHeight: '100dvh',
          maxWidth: 480,
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
          zIndex: 1,
        }}
      >
        <PastDueBanner />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}