// THE macro engine — Mifflin-St Jeor, deterministic, in code (never an LLM).
// ONE source of truth: used by onboarding AND the Goals recompute. Never duplicate.
//
// MINOR SAFETY FLOOR — non-negotiable:
//  • Under-18: never a calorie deficit. "cut_weight"/"make_weight" → maintenance.
//  • Everyone: calories are clamped to ≥ BMR × 1.2, always.
//  • Minors never get goal-weight fields or weight-loss framing (enforced by callers,
//    signalled here via isMinor).

export function ageFromDob(dob) {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const SEX_CONST = { male: 5, female: -161, unspecified: -78 }; // unspecified = midpoint → "estimate"

export function activityFactor(days) {
  const d = Number(days) || 0;
  if (d <= 1) return 1.2;
  if (d <= 3) return 1.375;
  if (d <= 5) return 1.55;
  if (d === 6) return 1.725;
  return 1.9;
}

export function computeTargets({ weightLbs, heightInches, age, sex = "unspecified", trainingDays = 4, goals = [], isMinor = false }) {
  const w = parseFloat(weightLbs);
  const h = parseFloat(heightInches);
  const a = parseInt(age, 10);
  if (!w || !h || !a) return null;

  const kg = w * 0.453592;
  const cm = h * 2.54;
  const bmr = Math.round(10 * kg + 6.25 * cm - 5 * a + (SEX_CONST[sex] ?? SEX_CONST.unspecified));
  const tdee = Math.round(bmr * activityFactor(trainingDays));

  // Goal adjustment — ADULTS 18+ only. Minors always get maintenance fueling.
  let calories = tdee;
  if (!isMinor && a >= 18) {
    if (goals.includes("gain_muscle")) calories = tdee + 400;
    else if (goals.includes("cut_weight")) calories = tdee - 400;
  }

  // HARD FLOOR — applies to every user, every recompute. Clamp, never trust inputs.
  const floor = Math.round(bmr * 1.2);
  const clamped = calories < floor;
  calories = Math.max(calories, floor);

  const protein = Math.round(w * 1.0);
  const fats = Math.round(w * 0.4);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));

  return {
    bmr_calories: bmr,
    tdee_calories: tdee,
    goal_calories: calories,
    goal_protein_g: protein,
    goal_fats_g: fats,
    goal_carbs_g: carbs,
    estimate: sex === "unspecified",
    clamped, // true → surface the "these numbers look low" warning
  };
}