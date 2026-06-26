import { Outlet } from "react-router-dom";
import BottomNav from "@/components/layout/BottomNav";
import { useTheme } from "@/lib/ThemeContext";

export default function AppLayout() {
  const { darkMode } = useTheme();

  return (
    <div className="min-h-screen" style={{ background: '#0D0D0F' }}>
      <div
        className="mx-auto relative ring-holes"
        style={{
          background: darkMode ? '#1B1B1D' : '#EDEEF0',
          color: darkMode ? '#EDEEF0' : '#15151A',
          minHeight: '100vh',
          maxWidth: 480,
          paddingBottom: 72,
          paddingLeft: 28,
          boxShadow: '-4px 0 18px rgba(0,0,0,0.5), 4px 0 18px rgba(0,0,0,0.5)',
        }}
      >
        <div className="absolute left-7 top-0 bottom-0 w-px" style={{ background: '#9BA3AC44' }} />
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}