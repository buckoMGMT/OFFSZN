// After auth: if the user has no Athlete record OR onboarding_complete !== true,
// redirect to /onboarding before rendering the app shell.
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function OnboardingGate({ children }) {
  const [state, setState] = useState("loading");

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1)
      .then((list) => {
        const a = list[0];
        setState(a && a.onboarding_complete === true ? "ok" : "redirect");
      })
      .catch(() => setState("ok")); // never trap the user on a fetch error
  }, []);

  if (state === "loading") {
    return <div className="fixed inset-0" style={{ background: "var(--surface-0)" }} />;
  }
  if (state === "redirect") return <Navigate to="/onboarding" replace />;
  return children;
}