// Minor-privacy gating for public surfaces (App Store / safety item 1.3).
// School/hometown + sport + name can physically locate a 13-year-old, so a
// minor's location fields are hidden on every public-facing surface unless
// their verified guardian has opted in (GuardianLink.public_exposure_approved,
// mirrored onto the Athlete record by the guardianConsent function).
// Adults unaffected.
export function locationVisible(athlete) {
  if (!athlete) return false;
  return !athlete.is_minor || !!athlete.public_exposure_approved;
}

export function publicSchool(athlete) {
  return locationVisible(athlete) ? athlete.school || null : null;
}

export function publicHometown(athlete) {
  return locationVisible(athlete) ? athlete.hometown || null : null;
}
