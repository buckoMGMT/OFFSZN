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
import { MilestoneNotifierProvider } from '@/lib/MilestoneNotifier';

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
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl font-display text-primary tracking-widest">THE PLAYBOOK</div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
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