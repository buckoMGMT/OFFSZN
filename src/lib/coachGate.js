// Coach discoverability gate: a coach appears in the Drills grid ONLY when
// every trust + storefront requirement is met. A coach charging $25/mo with
// an empty library is a refund and a 1-star review.

export function coachChecklist(a) {
  return [
    { key: "bio", label: "Bio + photo", done: !!a?.coach_bio && !!a?.avatar_url },
    { key: "rate", label: "Monthly rate set", done: (a?.coach_sub_price_usd || 0) > 0 },
    { key: "conduct", label: "Minor-safety conduct agreed", done: !!a?.minor_conduct_agreed_at },
    {
      key: "identity",
      label: a?.identity_status === "pending" ? "Identity (pending review)" : "Identity verified",
      done: a?.identity_status === "verified",
    },
    {
      key: "drills",
      label: `3 drills uploaded (${Math.min(a?.approved_video_count || 0, 3)}/3)`,
      done: (a?.approved_video_count || 0) >= 3,
    },
  ];
}

export default function isCoachDiscoverable(a) {
  if (!a) return false;
  if (a.role !== "coach") return true; // athlete-posted free drills aren't gated
  return coachChecklist(a).every((item) => item.done);
}