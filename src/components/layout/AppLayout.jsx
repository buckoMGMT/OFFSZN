import { Outlet } from "react-router-dom";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout() {
  /* iOS-native shell: full-bleed surface, content constrained to phone width,
     safe-area-aware bottom padding so the nav never clips content. */
  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-0)' }}>
      <div
        className="mx-auto relative"
        style={{
          background: 'var(--surface-0)',
          color: 'var(--text-primary)',
          minHeight: '100dvh',
          maxWidth: 480,
          paddingBottom: 'calc(72px + env(safe-area-inset-bottom))',
        }}
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}