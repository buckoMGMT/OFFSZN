import { lazy, Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingGate from '@/components/OnboardingGate';
import { ThemeProvider } from '@/lib/ThemeContext';
import GeoBlocker from '@/components/GeoBlocker';
import BrandMark from '@/components/BrandMark';
import { MilestoneNotifierProvider } from '@/lib/MilestoneNotifier';
import AppScroll from '@/components/layout/AppScroll';
import { initAccent } from '@/lib/accentColor';

// Lazy page routes — nothing heavy loads on first paint (Lighthouse §6)
const Feed = lazy(() => import('@/pages/Feed'));
const Track = lazy(() => import('@/pages/Track'));
const Playbook = lazy(() => import('@/pages/Playbook'));
const Clans = lazy(() => import('@/pages/Clans'));
const Profile = lazy(() => import('@/pages/Profile'));
const Rewards = lazy(() => import('@/pages/Rewards'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const AUP = lazy(() => import('@/pages/AUP'));
const Review = lazy(() => import('@/pages/Review'));
const SubscriptionSuccess = lazy(() => import('@/pages/SubscriptionSuccess'));
const Studio = lazy(() => import('@/pages/Studio'));
const CoachSubscribed = lazy(() => import('@/pages/CoachSubscribed'));

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
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
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
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Onboarding lives OUTSIDE AppLayout — no tab bar */}
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/aup" element={<AUP />} />
        {/* /review is gated SERVER-SIDE in the reviewQueue function — non-admins get 403 */}
        <Route path="/review" element={<Review />} />
        <Route path="/subscription/success" element={<SubscriptionSuccess />} />
        <Route path="/coach/:id/subscribed" element={<CoachSubscribed />} />
        <Route element={<OnboardingGate><AppLayout /></OnboardingGate>}>
          <Route path="/" element={<Feed />} />
          <Route path="/track" element={<Track />} />
          <Route path="/drills" element={<Playbook />} />
          <Route path="/clans" element={<Clans />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
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
            <AppScroll>
              <AuthenticatedApp />
            </AppScroll>
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