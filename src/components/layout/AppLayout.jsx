import { Outlet } from "react-router-dom";
import BottomNav from "@/components/layout/BottomNav";

export default function AppLayout() {
  return (
    <div className="min-h-screen" style={{ background: '#0D0D0F' }}>
      {/* Page surface wrapper — the "open page" in the binder */}
      <div
        className="mx-auto relative ring-holes"
        style={{
          background: '#EDEEF0',
          minHeight: '100vh',
          maxWidth: 480,
          paddingBottom: 72,
          paddingLeft: 28,  /* left margin for ring holes */
          boxShadow: '-4px 0 18px rgba(0,0,0,0.5), 4px 0 18px rgba(0,0,0,0.5)',
        }}
      >
        {/* Left-margin rule line */}
        <div className="absolute left-7 top-0 bottom-0 w-px" style={{ background: '#9BA3AC44' }} />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}