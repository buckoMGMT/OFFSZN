import KeepAliveOutlet from "@/components/layout/KeepAliveOutlet";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import EnvironmentLayer from "@/components/environment/EnvironmentLayer";
import CoachSubSuccessToast from "@/components/monetization/CoachSubSuccessToast";
import PastDueBanner from "@/components/monetization/PastDueBanner";
import ConsentBanner from "@/components/ConsentBanner";
import ReviewAlertBanner from "@/components/review/ReviewAlertBanner";

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
          /* Content always clears the fixed tab bar + safe inset */
          paddingBottom: 'calc(var(--bottomnav-h) + 16px)',
          /* No zIndex here — a stacking context on the content container traps
             full-screen sheets (workout runner, video player) UNDER the fixed
             nav/header. Sheets must win on their own z-index. */
        }}
      >
        <PastDueBanner />
        <ReviewAlertBanner />
        <KeepAliveOutlet />
      </div>
      <BottomNav />
      <ConsentBanner />
    </div>
  );
}