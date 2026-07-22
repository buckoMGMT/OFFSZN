import KeepAliveOutlet from "@/components/layout/KeepAliveOutlet";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import EnvironmentLayer from "@/components/environment/EnvironmentLayer";
import CoachSubSuccessToast from "@/components/monetization/CoachSubSuccessToast";
import PastDueBanner from "@/components/monetization/PastDueBanner";
import ConsentBanner from "@/components/ConsentBanner";

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
          /* §1 — reserve the dock's MAX footprint so no dock state change ever
             shifts page content; the dock floats over this reserved zone.
             Bottom buttons on every screen stay tappable in all dock states. */
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
          /* No zIndex here — a stacking context on the content container traps
             full-screen sheets (workout runner, video player) UNDER the fixed
             nav/header. Sheets must win on their own z-index. */
        }}
      >
        <PastDueBanner />
        <KeepAliveOutlet />
      </div>
      <BottomNav />
      <ConsentBanner />
    </div>
  );
}