import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, CheckCircle, Lock, Zap } from "lucide-react";
import ProgramCard from "@/components/playbook/ProgramCard";
import GoldBadge from "@/components/ui/GoldBadge";

const SPORTS = ["football", "basketball", "baseball", "soccer", "track", "volleyball", "wrestling", "swimming", "lacrosse", "other"];

const SAMPLE_PROGRAMS = [
  {
    id: "s1", title: "Fascia Release & Ankle Mobility", sport: "football", position: "skill",
    duration_minutes: 20, difficulty: "beginner", is_premium: false, description: "Target ankle stability and fascia release — the #1 overlooked limiter in high school athletes.",
    tags: ["fascia", "mobility", "stretch"],
    exercises: [
      { name: "Plantar Fascia Roll", category: "fascia", duration_seconds: 60, instructions: "Use lacrosse ball. Roll bottom of foot from heel to toe. 60 sec each side.", muscle_group: "foot" },
      { name: "Ankle Circles", category: "mobility", duration_seconds: 45, reps: 10, instructions: "Seated. Draw full circles with your foot, 10 in each direction.", muscle_group: "ankle" },
      { name: "Calf Stretch — Wall", category: "stretch", duration_seconds: 45, instructions: "Lean into wall. Back leg straight. Hold 45 sec each side.", muscle_group: "calf" },
      { name: "IT Band Release", category: "fascia", duration_seconds: 90, instructions: "Foam roll outer thigh from hip to knee slowly. Find tight spots and hold.", muscle_group: "IT band" },
    ],
    ncaa_benchmark_focus: "40-yard dash, vertical jump"
  },
  {
    id: "s2", title: "Facial & Jaw Strengthening", sport: "other", position: "",
    duration_minutes: 10, difficulty: "beginner", is_premium: false, description: "Most athletes ignore the face. Jaw and facial strength impacts oxygen intake and reaction time.",
    tags: ["fascia", "activation"],
    exercises: [
      { name: "Tongue Press", category: "activation", duration_seconds: 30, instructions: "Press tongue flat to roof of mouth. Hold 30 sec. Repeat 3x. Activates neck and jaw stability.", muscle_group: "jaw" },
      { name: "Jaw Masseter Release", category: "fascia", duration_seconds: 60, instructions: "Use fingertips to massage the masseter muscle (sides of jaw) in circles. Releases tension that limits O2 intake.", muscle_group: "face" },
      { name: "Neck Lateral Stretch", category: "stretch", duration_seconds: 30, instructions: "Tilt ear to shoulder. Other hand gently pulls head. Hold 30 sec each side.", muscle_group: "neck" },
    ]
  },
  {
    id: "s3", title: "Pre-Game Activation Routine", sport: "basketball", position: "guard",
    duration_minutes: 15, difficulty: "intermediate", is_premium: false, description: "Full activation sequence: hips, hams, quads, ankles. Hits NCAA agility benchmarks.",
    tags: ["activation", "stretch", "mobility"],
    exercises: [
      { name: "Hip 90/90 Stretch", category: "mobility", duration_seconds: 60, instructions: "Sit with both legs at 90 degrees. Lean forward over front shin. Hold. Switch.", muscle_group: "hip" },
      { name: "Hamstring Sweep", category: "stretch", duration_seconds: 45, reps: 10, instructions: "Standing. Hinge at hip with flat back, reach toward floor. 10 reps slow and controlled.", muscle_group: "hamstring" },
      { name: "Lateral Band Walk", category: "activation", sets: 2, reps: 15, instructions: "Mini band above knees. Step side-to-side staying low. Glute activation key for lateral quickness.", muscle_group: "glutes" },
      { name: "Explosive Calf Raise", category: "strength", sets: 3, reps: 15, instructions: "Rise fast, lower slow. Full range of motion. Builds reactive ankle strength.", muscle_group: "calf" },
    ],
    ncaa_benchmark_focus: "Lane agility, shuttle run"
  },
  {
    id: "s4", title: "Sleep Recovery Protocol", sport: "other", position: "",
    duration_minutes: 12, difficulty: "beginner", is_premium: false, description: "Pre-sleep routine that drops cortisol and improves deep sleep quality for recovery.",
    tags: ["mobility", "stretch"],
    exercises: [
      { name: "Legs Up The Wall", category: "mobility", duration_seconds: 180, instructions: "Lie on back, legs vertical on wall. Activates parasympathetic nervous system. 3 min.", muscle_group: "full body" },
      { name: "Diaphragmatic Breathing", category: "activation", sets: 3, reps: 10, instructions: "Hand on belly. Breathe so only belly rises. 4 sec in, 6 sec out. 10 reps.", muscle_group: "diaphragm" },
      { name: "Thoracic Twist", category: "mobility", duration_seconds: 30, instructions: "Lie on side, knees stacked. Open top arm to ceiling. Follow with eyes. 30 sec each side.", muscle_group: "thoracic spine" },
    ]
  },
  {
    id: "s5", title: "Elite D1 Speed & Power Program", sport: "football", position: "skill",
    duration_minutes: 40, difficulty: "advanced", is_premium: true, description: "The full system that took a high school athlete to D1 in months. NCAA combine prep.",
    tags: ["strength", "activation", "mobility"],
    exercises: [],
    ncaa_benchmark_focus: "40-yard dash, broad jump, vertical, bench press reps"
  },
];

export default function Playbook() {
  const [athlete, setAthlete] = useState(null);
  const [selectedSport, setSelectedSport] = useState("all");
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [completedExercises, setCompletedExercises] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1).then(list => {
      const a = list[0] || null;
      setAthlete(a);
      if (a?.sport) setSelectedSport(a.sport);
      setLoading(false);
    });
  }, []);

  const filtered = SAMPLE_PROGRAMS.filter(p =>
    selectedSport === "all" || p.sport === selectedSport || p.sport === "other"
  );

  const toggleExercise = (idx) => {
    setCompletedExercises(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const allComplete = selectedProgram &&
    selectedProgram.exercises.length > 0 &&
    selectedProgram.exercises.every((_, i) => completedExercises[i]);

  if (selectedProgram) {
    const isPremiumLocked = selectedProgram.is_premium && athlete?.subscription_tier !== "premium";

    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-4">
          <button onClick={() => { setSelectedProgram(null); setCompletedExercises({}); }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ChevronLeft size={20} />
            <span className="text-sm font-barlow uppercase">Back</span>
          </button>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-2xl font-barlow font-bold text-foreground uppercase leading-tight">{selectedProgram.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-muted-foreground font-barlow uppercase">{selectedProgram.duration_minutes} min</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground font-barlow capitalize">{selectedProgram.difficulty}</span>
              </div>
            </div>
            {selectedProgram.is_premium && <GoldBadge><Lock size={10} />Premium</GoldBadge>}
          </div>
        </div>

        <div className="px-4 py-4">
          {selectedProgram.description && (
            <div className="gradient-card border border-border rounded-2xl p-4 mb-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{selectedProgram.description}</p>
              {selectedProgram.ncaa_benchmark_focus && (
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <Zap size={14} className="text-primary" />
                  <p className="text-xs font-barlow font-bold text-primary uppercase">
                    NCAA Focus: {selectedProgram.ncaa_benchmark_focus}
                  </p>
                </div>
              )}
            </div>
          )}

          {isPremiumLocked ? (
            <div className="gradient-card border border-primary/30 rounded-2xl p-8 text-center">
              <Lock size={40} className="text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-barlow font-bold text-foreground uppercase mb-2">Premium Program</h3>
              <p className="text-sm text-muted-foreground mb-6">Unlock this elite program and the full Playbook with Premium.</p>
              <button className="gradient-gold text-primary-foreground px-8 py-3 rounded-xl font-barlow font-bold uppercase text-lg gold-glow">
                Upgrade to Premium — $9.99/mo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedProgram.exercises.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => toggleExercise(i)}
                  className={`w-full gradient-card border rounded-2xl p-4 flex items-start gap-4 text-left transition-all duration-200 ${
                    completedExercises[i] ? "border-green-500/40 bg-green-500/5" : "border-border"
                  }`}
                >
                  <div className={`mt-0.5 flex-shrink-0 transition-colors ${completedExercises[i] ? "text-green-400" : "text-muted-foreground"}`}>
                    {completedExercises[i] ? <CheckCircle size={22} /> : <div className="w-5.5 h-5.5 rounded-full border-2 border-current w-[22px] h-[22px]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`text-sm font-barlow font-bold uppercase ${completedExercises[i] ? "text-green-400 line-through" : "text-foreground"}`}>
                        {ex.name}
                      </h4>
                      <span className="text-[10px] font-barlow uppercase text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{ex.category}</span>
                    </div>
                    <div className="flex gap-3 mb-2">
                      {ex.duration_seconds && <span className="text-xs text-primary font-barlow">{ex.duration_seconds}s</span>}
                      {ex.sets && <span className="text-xs text-muted-foreground font-barlow">{ex.sets} sets</span>}
                      {ex.reps && <span className="text-xs text-muted-foreground font-barlow">{ex.reps} reps</span>}
                      {ex.muscle_group && <span className="text-xs text-purple-400 font-barlow">{ex.muscle_group}</span>}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{ex.instructions}</p>
                  </div>
                </button>
              ))}

              {allComplete && (
                <div className="gradient-gold rounded-2xl p-6 text-center gold-glow">
                  <CheckCircle size={32} className="text-primary-foreground mx-auto mb-2" />
                  <h3 className="text-2xl font-barlow font-bold text-primary-foreground uppercase">Session Complete!</h3>
                  <p className="text-sm text-primary-foreground/80 mt-1">You're building the playbook. Keep the streak alive.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 pt-12 pb-4">
        <h1 className="text-3xl font-barlow font-bold text-foreground uppercase mb-1">The Playbook</h1>
        <p className="text-xs text-muted-foreground font-barlow uppercase tracking-widest">Sport-Specific Performance Programs</p>
      </div>

      <div className="px-4 py-4">
        {/* Sport Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4">
          <button
            onClick={() => setSelectedSport("all")}
            className={`px-4 py-2 rounded-full font-barlow font-bold uppercase text-xs whitespace-nowrap transition-all ${
              selectedSport === "all" ? "gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            All Sports
          </button>
          {SPORTS.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSport(s)}
              className={`px-4 py-2 rounded-full font-barlow font-bold uppercase text-xs whitespace-nowrap transition-all ${
                selectedSport === s ? "gradient-gold text-primary-foreground" : "bg-secondary text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Info Banner */}
        <div className="gradient-card border border-primary/20 rounded-2xl p-4 mb-4 flex gap-3">
          <Zap size={18} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-barlow font-bold text-primary uppercase mb-0.5">Knowledge is the Playbook</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              These are the overlooked details — fascia work, facial strengthening, sleep protocols — that most athletes never know. This is what unlocks the ceiling.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map(program => (
            <ProgramCard
              key={program.id}
              program={program}
              onClick={() => setSelectedProgram(program)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}