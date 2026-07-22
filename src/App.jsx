import { lazy, Suspense, useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingGate from '@/components/OnboardingGate';
import SubPageLayout from '@/components/layout/SubPageLayout';
import { ThemeProvider } from '@/lib/ThemeContext';
import GeoBlocker from '@/components/GeoBlocker';
import BrandMark from '@/components/BrandMark';
import { MilestoneNotifierProvider } from '@/lib/MilestoneNotifier';
import AppScroll from '@/components/layout/AppScroll';
import { initAccent } from '@/lib/accentColor';
import AppErrorBoundary from '@/components/AppErrorBoundary';
import { DockProvider } from '@/lib/DockContext';
import { MiniPlayerProvider } from '@/lib/MiniPlayerContext';
import GlobalVideoPlayer from '@/components/feed/GlobalVideoPlayer';

// Lazy page routes — nothing heavy loads on first paint (Lighthouse §6)
const Feed = lazy(() => import('@/pages/Feed'));
const Track = lazy(() => import('@/pages/Track'));
const Playbook = lazy(() => import('@/pages/Playbook'));
const Clans = lazy(() => import('@/pages/Clans'));
const Profile = lazy(() => import('@/pages/Profile'));
const Rewards = lazy(() => import('@/pages/Rewards'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const AUP = lazy(() => import('@/pages/AUP'));
const Help = lazy(() => import('@/pages/Help'));
const Review = lazy(() => import('@/pages/Review'));
const SubscriptionSuccess = lazy(() => import('@/pages/SubscriptionSuccess'));
const Studio = lazy(() => import('@/pages/Studio'));
const CoachSubscribed = lazy(() => import('@/pages/CoachSubscribed'));
const GuardianVerify = lazy(() => import('@/pages/GuardianVerify'));
// Branded auth pages — users must NEVER land on a default platform login page
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));

const AuthRoutes = () => (
  <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {/* OAuth/auth callback paths must never 404 — funnel them to login */}
      <Route path="/auth/*" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  </Suspense>
);

// Apply any saved custom accent before first paint
initAccent();

// Skeleton fallback — never a spinner
const PageSkeleton = () => (
  <div className="min-h-screen px-5 pt-14 space-y-4" style={{ background: 'var(--surface-0)', maxWidth: 480, margin: '0 auto' }}>
    <div className="skeleton" style={{ width: '45%', height: 28 }} />
    <div className="skeleton" style={{ width: '100%', height: 120, borderRadius: 'var(--r-lg)' }} />
    <div className="skeleton" style={{ width: '100%', height: 80, borderRadius: 'var(--r-lg)' }} />
    <div className="skeleton" style={{ width: '70%', height: 14 }} />
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
  // Loader shows for a minimum of 300ms — one steady branded state, no strobe on fast loads
  const [minHold, setMinHold] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setMinHold(false), 300);
    return () => clearTimeout(t);
  }, []);

  if (isLoadingPublicSettings || isLoadingAuth || minHold) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: 'var(--surface-0)' }}>
        <div className="flex flex-col items-center" style={{ gap: 24 }}>
          <BrandMark size="lg" />
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
      // Branded OFFSZN login — never the platform's default page
      return <AuthRoutes />;
    }
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Auth pages stay reachable (email links, deep links) even with a live session */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Onboarding lives OUTSIDE AppLayout — no tab bar */}
        <Route path="/onboarding" element={<Onboarding />} />
        {/* Nested views get the TopBar in back-button mode */}
        <Route element={<SubPageLayout />}>
          <Route path="/aup" element={<AUP />} />
          <Route path="/help" element={<Help />} />
          {/* /review is gated SERVER-SIDE in the reviewQueue function — non-admins get 403 */}
          <Route path="/review" element={<Review />} />
          <Route path="/subscription/success" element={<SubscriptionSuccess />} />
          <Route path="/coach/:id/subscribed" element={<CoachSubscribed />} />
          {/* Guardian invite landing — outside OnboardingGate (guardians may have no athlete profile) */}
          <Route path="/guardian" element={<GuardianVerify />} />
        </Route>
        <Route element={<OnboardingGate><AppLayout /></OnboardingGate>}>
          <Route path="/" element={<Feed />} />
          <Route path="/track" element={<Track />} />
          <Route path="/drills" element={<Playbook />} />
          <Route path="/clans" element={<Clans />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        {/* OAuth/auth callback paths must never 404 with a live session — go home */}
        <Route path="/auth/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
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
            <AppErrorBoundary>
              <DockProvider>
                <MiniPlayerProvider>
                  <AppScroll>
                    <AuthenticatedApp />
                  </AppScroll>
                  {/* Single app-wide video surface — full-screen + draggable mini-player */}
                  <GlobalVideoPlayer />
                </MiniPlayerProvider>
              </DockProvider>
            </AppErrorBoundary>
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