// Step builders — every program is runnable, curated or not.

// Curated exercises if present; otherwise generate a sane default structure
// from the program's own metadata (video + targeted areas, default 3×10).
export function buildStepsFromProgram(p) {
  if (Array.isArray(p.exercises) && p.exercises.length) {
    return p.exercises.map(ex => ({
      name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      duration_seconds: ex.duration_seconds,
      note: ex.instructions,
    }));
  }
  const steps = [{ name: "Warm-Up", duration_seconds: 180, note: "Dynamic warm-up — get loose before the work starts." }];
  if (p.video_url) steps.push({ name: `Watch: ${p.title}`, video_url: p.video_url, note: "Follow along with the drill video." });
  (p.targeted_areas || ["Full Body"]).forEach(area =>
    steps.push({ name: `${area} Block`, sets: 3, reps: 10, note: p.aim })
  );
  steps.push({ name: "Finisher", duration_seconds: 60, note: "Max effort — empty the tank." });
  return steps;
}

// Playlist runner: each drill/program = one step, auto-advance in order.
export function buildStepsFromPlaylist(programs) {
  return programs.map(p => ({
    name: p.title,
    video_url: p.video_url,
    sets: p.video_url ? undefined : 3,
    reps: p.video_url ? undefined : 10,
    note: `${p.duration} min · ${p.difficulty}`,
  }));
}