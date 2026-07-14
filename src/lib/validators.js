// §5 Zod validation sweep — client-side schemas for every user-input surface.
// Server-side re-validation lives in the backend functions that write.
import { z } from "zod";

// Trim + strip control characters; reject empty-after-trim happens per-schema.
export const clean = (s) =>
  typeof s === "string" ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : s;

const cleanStr = z.string().transform(clean);

// Optional number: empty string / null → undefined (not 0), else coerced + bounded.
const optNum = (min, max, msg) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().min(min, msg).max(max, msg).optional());

export const onboardingSchema = z.object({
  display_name: cleanStr.pipe(z.string().min(1, "Name is required").max(40, "Max 40 characters")),
  weight_lbs: z.coerce.number().min(50, "Weight must be 50–500 lbs").max(500, "Weight must be 50–500 lbs"),
  height_inches: z.coerce.number().min(36, "Height must be 36–96 in").max(96, "Height must be 36–96 in"),
  goal_weight_lbs: optNum(50, 500, "Goal weight must be 50–500 lbs"),
});

export const dobSchema = z.coerce.date()
  .refine((d) => !isNaN(d.getTime()) && d < new Date(), "Enter a real past date")
  .refine((d) => d > new Date("1900-01-01"), "Enter a real past date");

export const liftSchema = optNum(0, 1500, "Must be 0–1500 lbs");
export const mileSchema = optNum(0, 3600, "Must be 0–3600 seconds");

export const goalsSchema = z.object({
  goal_calories: optNum(800, 8000, "Calories must be 800–8000"),
  goal_protein_g: optNum(0, 1000, "Protein must be 0–1000 g"),
  goal_carbs_g: optNum(0, 1000, "Carbs must be 0–1000 g"),
  goal_fats_g: optNum(0, 1000, "Fats must be 0–1000 g"),
  water_goal_oz: optNum(0, 300, "Water must be 0–300 oz"),
  sleep_goal_hours: optNum(0, 24, "Sleep must be 0–24 h"),
});

export const postSchema = z.object({
  content: cleanStr.pipe(z.string().max(2000, "Max 2,000 characters")),
  image_url: z.string().optional(),
}).refine((v) => v.content.length > 0 || !!v.image_url, { message: "Add text or a photo", path: ["content"] });

export const commentSchema = cleanStr.pipe(
  z.string().min(1, "Comment can't be empty").max(500, "Max 500 characters"));

export const coachBioSchema = cleanStr.pipe(z.string().max(300, "Max 300 characters"));

export const coachPriceSchema = z.coerce.number()
  .min(0, "Price must be $0–500").max(500, "Price must be $0–500")
  .refine((n) => Math.round(n * 100) === n * 100, "Max 2 decimal places");

export const feedbackSchema = cleanStr.pipe(
  z.string().min(1, "Message can't be empty").max(1000, "Max 1,000 characters"));

export const reportNoteSchema = cleanStr.pipe(z.string().max(500, "Max 500 characters"));

// Helper: validate, return { value } or { error: firstMessage }
export function validate(schema, input) {
  const r = schema.safeParse(input);
  if (r.success) return { value: r.data };
  return { error: r.error.issues[0]?.message || "Invalid input" };
}