import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useState } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import Feed from '@/pages/Feed';
import Track from '@/pages/Track';
import Playbook from '@/pages/Playbook';
import Clans from '@/pages/Clans';
import Profile from '@/pages/Profile';
import Rewards from '@/pages/Rewards';
import PlaybookSplash from '@/components/PlaybookSplash';
import { ThemeProvider } from '@/lib/ThemeContext';
import GeoBlocker from '@/components/GeoBlocker';
import BrandMark from '@/components/BrandMark';
import { MilestoneNotifierProvider } from '@/lib/MilestoneNotifier';
import { initAccent } from '@/lib/accentColor';

// Apply any saved custom accent before first paint — covers the splash screen too
initAccent();

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  // Show splash only on first visit per session
  const [showSplash] = useState(() => !sessionStorage.getItem('pb_splash_seen'));

  const handleSplashDone = () => {
    sessionStorage.setItem('pb_splash_seen', '1');
    setSplashDone(true);
  };

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--surface-0)' }}>
        <div className="flex flex-col items-center" style={{ gap: 24 }}>
          <BrandMark size="lg" />
          {/* Skeleton pulse instead of spinner */}
          <div
            className="skeleton"
            style={{ width: 120, height: 4, borderRadius: 'var(--r-full)', marginTop: 8 }}
          />
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  if (showSplash && !splashDone) {
    return <PlaybookSplash onDone={handleSplashDone} />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Feed />} />
        <Route path="/track" element={<Track />} />
        <Route path="/playbook" element={<Playbook />} />
        <Route path="/clans" element={<Clans />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <GeoBlocker>
    <ThemeProvider>
      <MilestoneNotifierProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
      </MilestoneNotifierProvider>
    </ThemeProvider>
    </GeoBlocker>
  )
}

export default App