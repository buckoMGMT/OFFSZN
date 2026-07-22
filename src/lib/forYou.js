// Deterministic "Picked for your SZN" scoring — runs in code, instant, no LLM.
// Factors (per the spec):
//   sport/position match      +3
//   season-appropriate tag    +2   (in_season → skill/recovery; off/pre → strength/speed)
//   equipment fit             +2
//   goal alignment            +2   (training_goals ↔ program category/aim)
//   recently-watched similar  +1   (same sport as a recently-opened program)
//   coach followed/subscribed +2   (drills: n/a; coaches: is subscribed)
// Cold start: falls back to top drills in the athlete's sport.
// Completed drills are excluded by the caller.

const GOAL_TAGS = {
  get_faster: ["speed"],
  get_stronger: ["strength"],
  gain_muscle: ["strength"],
  conditioning: ["endurance"],
  cut_weight: ["nutrition", "endurance"],
  make_weight: ["nutrition"],
  recruiting: ["skill", "speed"],
  starting_spot: ["skill", "strength"],
  stay_ready: ["recovery", "skill"],
  general_health: ["endurance", "strength"],
};

function seasonCategories(status) {
  if (status === "in_season") return ["skill", "recovery"];
  return ["strength", "speed"]; // off/pre-season
}

// programs: the static PROGRAM list. Returns top `count` scored programs.
export function pickDrillsForYou(athlete, programs, { count = 6, excludeIds = [] } = {}) {
  if (!athlete) return programs.slice(0, count);

  const sport = (athlete.sport || "").replace(/_/g, " ");
  const goals = athlete.training_goals || [];
  const goalCats = new Set(goals.flatMap((g) => GOAL_TAGS[g] || []));
  const seasonCats = new Set(seasonCategories(athlete.season_status));
  const equip = athlete.equipment_access; // full_gym | home_gym | bodyweight_only
  const recent = JSON.parse(localStorage.getItem("pb_recent_programs") || "[]");
  const recentSports = new Set(
    recent.map((id) => programs.find((p) => p.id === id)?.sport).filter(Boolean)
  );

  const scored = programs
    .filter((p) => !excludeIds.includes(p.id))
    .map((p) => {
      let score = 0;
      const cat = (p.category || "").toLowerCase();
      // sport/position
      if (sport && p.sport && p.sport.toLowerCase() === sport.toLowerCase()) score += 3;
      if (athlete.position && p.positions && p.positions.toLowerCase().includes(athlete.position.toLowerCase())) score += 3;
      // season-appropriate category
      if (seasonCats.has(cat)) score += 2;
      // equipment fit — bodyweight programs fit everyone; gym-only penalized for bodyweight athletes
      if (equip === "bodyweight_only") {
        if (/bodyweight/i.test(p.description || "")) score += 2;
      } else {
        score += 2; // full/home gym can do anything
      }
      // goal alignment
      if (goalCats.has(cat)) score += 2;
      // recently-watched similarity
      if (p.sport && recentSports.has(p.sport)) score += 1;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((s) => s.score > 0).map((s) => s.p);
  // Cold start / thin results — top drills in the athlete's sport, then anything
  if (top.length < count) {
    const bySport = programs
      .filter((p) => !excludeIds.includes(p.id) && p.sport?.toLowerCase() === sport.toLowerCase() && !top.includes(p))
      .concat(programs.filter((p) => !excludeIds.includes(p.id) && !top.includes(p)));
    return [...top, ...bySport].slice(0, count);
  }
  return top.slice(0, count);
}

// Coaches for you — sport match (+3), specialty ↔ goal (+2), subscribed (+2),
// verified (+1). Requires a pfp + bio to surface at all (already the gate).
export function pickCoachesForYou(athlete, coaches, subscribedIds = [], { count = 6 } = {}) {
  const displayable = coaches.filter((c) => c.role === "coach" && c.avatar_url && c.coach_bio);
  if (!athlete) return displayable.slice(0, count);

  const sport = (athlete.sport || "").toLowerCase();
  const goalCats = new Set((athlete.training_goals || []).flatMap((g) => GOAL_TAGS[g] || []));

  return displayable
    .map((c) => {
      let score = 0;
      if (sport && c.sport?.toLowerCase() === sport) score += 3;
      const specialties = (c.coach_specialties || []).map((s) => s.toLowerCase());
      if (specialties.some((s) => [...goalCats].some((g) => s.includes(g)))) score += 2;
      if (subscribedIds.includes(c.id)) score += 2;
      if (c.is_coach_verified) score += 1;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((s) => s.c)
    .slice(0, count);
}