import { Outlet } from "react-router-dom";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout() {
  return (
    /* Psychology: Doherty threshold — every interaction responds within 400ms.
       Removed the binder-margin and heavy box-shadow — clean elevation from surface ladder. */
    <div className="min-h-screen" style={{ background: 'var(--surface-0)' }}>
      <div
        className="mx-auto relative"
        style={{
          background: 'var(--surface-0)',
          color: 'var(--text-primary)',
          minHeight: '100dvh',
          maxWidth: 480,
          paddingBottom: 72,
        }}
      >
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}