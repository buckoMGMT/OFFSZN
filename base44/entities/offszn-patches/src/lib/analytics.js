// src/lib/analytics.js — PostHog, consent-gated (replaces prior version).
import posthog from "posthog-js";
const KEY = "offszn_analytics_consent"; // "granted" | "declined"
let initialized = false;

export const consentAnswered = () => !!localStorage.getItem(KEY);

export function initAnalytics() {
  if (localStorage.getItem(KEY) !== "granted") return; // no consent, no tracking
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key || initialized) return;
  posthog.init(key, {
    api_host: "https://us.i.posthog.com",
    capture_pageview: true, capture_pageleave: true, autocapture: true,
    persistence: "localStorage",
  });
  initialized = true;
}
export function grantAnalyticsConsent() { localStorage.setItem(KEY, "granted"); initAnalytics(); }
export function declineAnalyticsConsent() { localStorage.setItem(KEY, "declined"); }

export const track = {
  signupCompleted: () => initialized && posthog.capture("signup_completed"),
  onboardingCompleted: (p) => initialized && posthog.capture("onboarding_completed", p),
  firstDailyLog: () => initialized && posthog.capture("first_daily_log"),
  dailyLogCompleted: (p) => initialized && posthog.capture("daily_log_completed", p),
  passSubscribed: () => initialized && posthog.capture("allszn_pass_subscribed"),
  coachSubscribed: (p) => initialized && posthog.capture("coach_subscribed", p),
  postCreated: (p) => initialized && posthog.capture("post_created", p),
  teamJoined: () => initialized && posthog.capture("team_joined"),
};
export function identifyAthlete(id, props = {}) {
  if (!initialized) return;
  posthog.identify(id, { sport: props.sport, role: props.role, grade: props.grade }); // ID only — never email/DOB
}
