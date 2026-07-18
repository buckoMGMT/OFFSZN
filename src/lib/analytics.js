// Consent-gated analytics — thin wrapper over base44.analytics.
// Athlete ID only. Never email, DOB, or name.
import { base44 } from "@/api/base44Client";

// Opt-in only: no events fire until the user explicitly accepts in the ConsentBanner.
const consented = () => localStorage.getItem("offszn_analytics_consent") === "on";

const t = (eventName, properties = {}) => {
  if (!consented()) return;
  try { base44.analytics.track({ eventName, properties }); } catch { /* never break UX for analytics */ }
};

export const track = {
  signupCompleted: () => t("signup_completed"),
  onboardingCompleted: (p = {}) => t("onboarding_completed", p),
  firstDailyLog: () => t("first_daily_log"), // activation event
  dailyLogCompleted: (p = {}) => t("daily_log_completed", p),
  passSubscribed: () => t("pass_subscribed"),
  coachSubscribed: (p = {}) => t("coach_subscribed", p),
  postCreated: (p = {}) => t("post_created", p),
  teamJoined: () => t("team_joined"),
};

export const identifyAthlete = (athleteId, props = {}) =>
  t("identify_athlete", { athlete_id: athleteId, ...props });