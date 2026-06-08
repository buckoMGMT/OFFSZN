import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, Play, Clock, Target, Flame, Bookmark, BookmarkCheck, Plus, X, ChevronRight, ListVideo } from "lucide-react";
import PlaybookFilters from "@/components/playbook/PlaybookFilters";
import VideoPlayer from "@/components/feed/VideoPlayer";

const SPORT_FILTERS = ["All", "Football", "Basketball", "Baseball", "Soccer", "Track", "Volleyball", "Wrestling", "Swimming", "Lacrosse"];

const PROGRAMS = [
  { id: 1, title: "Elite Linebacker Training", sport: "Football", duration: 45, isPremium: false, category: "Strength", aim: "Build explosive power and tackle force", targeted_areas: ["Legs", "Core", "Upper Body"], difficulty: "Advanced", description: "Full-body power program designed for linebackers.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80", timing: "Pre-workout" },
  { id: 2, title: "Point Guard Explosiveness", sport: "Basketball", duration: 30, isPremium: false, category: "Speed", aim: "Improve first-step quickness and lateral speed", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Lateral quickness and first-step explosion drills.", cover: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80", timing: "Pre-workout" },
  { id: 3, title: "D1 Pitcher Arm Care", sport: "Baseball", duration: 20, isPremium: true, category: "Recovery", aim: "Protect arm health and increase velocity", targeted_areas: ["Shoulders", "Upper Body"], difficulty: "Beginner", description: "NCAA-level arm health and velocity program.", cover: "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&q=80", timing: "Post-workout" },
  { id: 4, title: "Sprint Mechanics & Speed", sport: "Track", duration: 40, isPremium: false, category: "Speed", aim: "Shave time off your 40 and improve form", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Optimize your form and shave time off your 40.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80", timing: "Pre-workout" },
  { id: 5, title: "Soccer Conditioning Block", sport: "Soccer", duration: 50, isPremium: true, category: "Endurance", aim: "Build 90-minute match stamina", targeted_areas: ["Legs", "Core", "Full Body"], difficulty: "Advanced", description: "90-minute match stamina and agility builder.", cover: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80", timing: "Anytime" },
  { id: 6, title: "Volleyball Jump Program", sport: "Volleyball", duration: 35, isPremium: false, category: "Strength", aim: "Increase vertical by 4–6 inches in 8 weeks", targeted_areas: ["Legs", "Glutes"], difficulty: "Intermediate", description: "Increase your vertical by 4–6 inches in 8 weeks.", cover: "https://images.unsplash.com/photo-1592656094267-764a45160876?w=400&q=80", timing: "Pre-workout" },
  { id: 7, title: "Wrestler Weight Cut Protocol", sport: "Wrestling", duration: 25, isPremium: true, category: "Nutrition", aim: "Safe competition weight management", targeted_areas: ["Full Body"], difficulty: "Advanced", description: "Safe and legal weight management for competition.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80", timing: "Anytime" },
  { id: 8, title: "Swimmer Dryland Strength", sport: "Swimming", duration: 40, isPremium: false, category: "Strength", aim: "Build pulling power and core stability", targeted_areas: ["Upper Body", "Core", "Shoulders"], difficulty: "Intermediate", description: "Build the pulling strength and core power swimmers need.", cover: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80", timing: "Pre-workout" },
  { id: 9, title: "Quarterback Pocket Presence", sport: "Football", duration: 30, isPremium: true, category: "Skill", aim: "Sharpen decision-making and release timing", targeted_areas: ["Core", "Shoulders", "Upper Body"], difficulty: "Advanced", description: "Decision-making, footwork, and release timing drills.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80", timing: "Anytime" },
  { id: 10, title: "Post Player Footwork", sport: "Basketball", duration: 35, isPremium: false, category: "Skill", aim: "Dominate the paint with elite footwork", targeted_areas: ["Legs", "Core"], difficulty: "Beginner", description: "Dominate the paint with elite footwork patterns.", cover: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80", timing: "Anytime" },
  { id: 11, title: "WR Route Running Mastery", sport: "Football", duration: 25, isPremium: false, category: "Speed", aim: "Perfect release and separation techniques", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Run sharper routes and create separation at the line.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80", timing: "Pre-workout" },
  { id: 12, title: "Core Stability Foundation", sport: "Track", duration: 18, isPremium: false, category: "Strength", aim: "Build a rock-solid athletic core", targeted_areas: ["Core"], difficulty: "Beginner", description: "A foundational core program for all athletes.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80", timing: "Anytime" },
  { id: 13, title: "Top 5 Speed Drills — Football", sport: "Football", duration: 14, isPremium: false, category: "Speed", aim: "Explosive sprint starts & acceleration for skill positions", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Coach Dane Miller's 5 bodyweight speed exercises built for RBs, WRs, DBs, and LBs. A-Skips, Dions, Bounds, Tuck Jumps & Hill Sprints — zero equipment needed.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "RB, WR, DB, LB" },
  { id: 14, title: "Top 5 Speed Drills — Soccer", sport: "Soccer", duration: 14, isPremium: false, category: "Speed", aim: "Sprint speed and acceleration for all positions on the pitch", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "5 bodyweight sprint drills to dominate the pitch. Improve sprint starts, acceleration, and top-end speed without any gym equipment.", cover: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "All Positions" },
  { id: 15, title: "Top 5 Speed Drills — Basketball", sport: "Basketball", duration: 14, isPremium: false, category: "Speed", aim: "First-step quickness and sprint speed for guards and wings", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Improve court speed and transition explosiveness. These bodyweight drills directly translate to faster first steps and better chase-down ability.", cover: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "Guards, Wings" },
  { id: 16, title: "Top 5 Speed Drills — Baseball", sport: "Baseball", duration: 14, isPremium: false, category: "Speed", aim: "Base-running speed and outfield acceleration", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Bodyweight sprint mechanics for faster base running and quicker break-in-direction reaction in the field. No equipment required.", cover: "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "Base Runners, Fielders" },
  { id: 17, title: "Top 5 Speed Drills — Lacrosse", sport: "Lacrosse", duration: 14, isPremium: false, category: "Speed", aim: "Field speed and acceleration for lacrosse athletes", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Improve field speed, sprint mechanics, and explosive acceleration for lacrosse athletes. These bodyweight-only drills can be done anywhere.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "All Positions" },
  { id: 18, title: "Top 5 Speed Drills — Track", sport: "Track", duration: 14, isPremium: false, category: "Speed", aim: "Sprint mechanics and acceleration for sprinters", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "A-Skips, Dions, Single-Leg Bounds, Tuck Jumps, and Hill Sprints for sprinters looking to shave time and refine mechanics.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "Sprinters" },
];

const CATEGORY_COLORS = {
  Strength: "bg-red-500/20 text-red-400",
  Speed: "bg-yellow-500/20 text-yellow-400",
  Recovery: "bg-blue-500/20 text-blue-400",
  Endurance: "bg-green-500/20 text-green-400",
  Nutrition: "bg-purple-500/20 text-purple-400",
  Skill: "bg-primary/20 text-primary",
};

const DIFFICULTY_COLORS = {
  Beginner: "text-green-400",
  Intermediate: "text-yellow-400",
  Advanced: "text-red-400",
};

function matchesTime(duration, range) {
  if (range === "All") return true;
  if (range === "<20m") return duration < 20;
  if (range === "20–35m") return duration >= 20 && duration <= 35;
  if (range === "35m+") return duration > 35;
  return true;
}

export default function Playbook() {
  const [athlete, setAthlete] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [tab, setTab] = useState("programs"); // programs | saved | playlists
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistPrograms, setPlaylistPrograms] = useState([]);
  const [filters, setFilters] = useState({ timeRange: "All", muscleGroup: "All", aim: "All", difficulty: "All", sortBy: "default" });

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1).then(list => {
      const a = list[0] || null;
      setAthlete(a);
      if (a) {
        base44.entities.SavedWorkout.filter({ athlete_id: a.id }).then(saved => setSavedIds(saved.map(s => s.program_id)));
        base44.entities.Playlist.filter({ athlete_id: a.id }).then(setPlaylists);
      }
    });
  }, []);

  const isPremium = athlete?.subscription_tier === "premium";

  const toggleSave = async (program, e) => {
    e.stopPropagation();
    if (!isPremium || !athlete) return;
    if (savedIds.includes(program.id)) {
      const saved = await base44.entities.SavedWorkout.filter({ athlete_id: athlete.id, program_id: program.id });
      if (saved[0]) await base44.entities.SavedWorkout.delete(saved[0].id);
      setSavedIds(prev => prev.filter(id => id !== program.id));
    } else {
      await base44.entities.SavedWorkout.create({ athlete_id: athlete.id, program_id: program.id });
      setSavedIds(prev => [...prev, program.id]);
    }
  };

  const createPlaylist = async () => {
    if (!playlistName || !athlete) return;
    const p = await base44.entities.Playlist.create({ name: playlistName, athlete_id: athlete.id, program_ids: playlistPrograms });
    setPlaylists(prev => [...prev, p]);
    setShowCreatePlaylist(false);
    setPlaylistName("");
    setPlaylistPrograms([]);
  };

  const deletePlaylist = async (id) => {
    await base44.entities.Playlist.delete(id);
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const filtered = PROGRAMS.filter(p => {
    const matchSport = sportFilter === "All" || p.sport === sportFilter;
    const matchTime = matchesTime(p.duration, filters.timeRange);
    const matchMuscle = filters.muscleGroup === "All" || p.targeted_areas?.includes(filters.muscleGroup);
    const matchAim = filters.aim === "All" || p.category === filters.aim;
    const matchDiff = filters.difficulty === "All" || p.difficulty === filters.difficulty;
    return matchSport && matchTime && matchMuscle && matchAim && matchDiff;
  }).sort((a, b) => {
    if (filters.sortBy === "duration-asc") return a.duration - b.duration;
    if (filters.sortBy === "duration-desc") return b.duration - a.duration;
    return 0;
  });

  const savedPrograms = PROGRAMS.filter(p => savedIds.includes(p.id));

  if (selected) {
    const isSaved = savedIds.includes(selected.id);
    return (
      <div className="min-h-screen bg-background">
        <div className="relative h-56 w-full overflow-hidden">
          <img src={selected.cover} alt={selected.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <button onClick={() => setSelected(null)}
            className="absolute top-14 left-4 bg-black/50 text-white rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
            ← Back
          </button>
          {isPremium && (
            <button onClick={(e) => toggleSave(selected, e)}
              className="absolute top-14 right-4 bg-black/50 text-white rounded-full p-2 backdrop-blur-sm">
              {isSaved ? <BookmarkCheck size={16} className="text-primary" /> : <Bookmark size={16} />}
            </button>
          )}
          {selected.isPremium && !isPremium && (
            <div className="absolute top-14 right-4 bg-primary/90 text-primary-foreground rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1">
              <Lock size={10} /> Premium
            </div>
          )}
        </div>
        <div className="px-4 -mt-8 relative z-10 pb-8">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${CATEGORY_COLORS[selected.category]}`}>
            {selected.category}
          </span>
          <h1 className="text-2xl font-barlow font-bold text-foreground uppercase mb-1">{selected.title}</h1>
          
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><Clock size={11} /> {selected.duration} min</span>
            <span className="flex items-center gap-1"><Flame size={11} /> {selected.timing}</span>
            <span className={`font-semibold ${DIFFICULTY_COLORS[selected.difficulty]}`}>{selected.difficulty}</span>
            {selected.positions && <span>· {selected.positions}</span>}
          </div>

          {/* Aim */}
          <div className="bg-card border border-border rounded-xl p-3 mb-3 flex items-start gap-2">
            <Target size={14} className="text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Aim</p>
              <p className="text-sm text-foreground font-medium">{selected.aim}</p>
            </div>
          </div>

          {/* Targeted Areas */}
          <div className="bg-card border border-border rounded-xl p-3 mb-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Targeted Areas</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.targeted_areas.map(area => (
                <span key={area} className="px-2 py-1 bg-secondary rounded-full text-xs font-medium text-foreground">{area}</span>
              ))}
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{selected.description}</p>

          {selected.video_url && (
            <div className="mb-6 rounded-xl overflow-hidden border border-border">
              <VideoPlayer url={selected.video_url} />
            </div>
          )}

          {selected.isPremium && !isPremium ? (
            <div className="gradient-gold rounded-2xl p-5 text-center gold-glow">
              <Lock size={24} className="text-primary-foreground mx-auto mb-2" />
              <h3 className="text-lg font-barlow font-bold text-primary-foreground uppercase mb-1">Premium Program</h3>
              <p className="text-xs text-primary-foreground/80 mb-4">Upgrade to unlock elite D1 training programs.</p>
              <button className="bg-primary-foreground text-primary px-6 py-2.5 rounded-xl font-barlow font-bold uppercase text-sm">
                Upgrade — $9.99/mo
              </button>
            </div>
          ) : (
            <button className="w-full gradient-gold text-primary-foreground py-4 rounded-2xl font-barlow font-bold uppercase text-lg tracking-wide gold-glow flex items-center justify-center gap-2">
              <Play size={18} fill="currentColor" /> Start Program
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background border-b border-border px-4 pt-12 pb-3">
        <h1 className="text-xl font-bold text-foreground mb-3">Playbook</h1>
        {/* Tab Bar */}
        <div className="flex gap-1 bg-secondary rounded-lg p-1 mb-3">
          <button onClick={() => setTab("programs")}
            className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === "programs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            Programs
          </button>
          <button onClick={() => setTab("saved")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === "saved" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Bookmark size={11} /> Saved {savedIds.length > 0 && `(${savedIds.length})`}
          </button>
          <button onClick={() => setTab("playlists")}
            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === "playlists" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <ListVideo size={11} /> Playlists
          </button>
        </div>

        {tab === "programs" && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {SPORT_FILTERS.map(sport => (
              <button key={sport} onClick={() => setSportFilter(sport)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  sportFilter === sport ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}>
                {sport}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {tab === "programs" && (
          <>
            <PlaybookFilters filters={filters} onFilterChange={setFilters} resultCount={filtered.length} />
            <div className="columns-2 gap-3">
              {filtered.map(program => {
                const isSaved = savedIds.includes(program.id);
                return (
                  <div key={program.id} className="break-inside-avoid mb-3 cursor-pointer" onClick={() => setSelected(program)}>
                    <div className="relative rounded-xl overflow-hidden bg-card border border-border">
                      <div className="relative">
                        <img src={program.cover} alt={program.title} className="w-full object-cover"
                          style={{ height: program.id % 3 === 0 ? 170 : 130 }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        {program.isPremium && (
                          <div className="absolute top-2 left-2 bg-primary/90 rounded-full p-1">
                            <Lock size={9} className="text-primary-foreground" />
                          </div>
                        )}
                        {isPremium && (
                          <button onClick={(e) => toggleSave(program, e)}
                            className="absolute top-2 right-2 bg-black/40 rounded-full p-1">
                            {isSaved ? <BookmarkCheck size={12} className="text-primary" /> : <Bookmark size={12} className="text-white/70" />}
                          </button>
                        )}
                        <div className="absolute bottom-2 left-2 right-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold mb-1 ${CATEGORY_COLORS[program.category]}`}>
                            {program.category}
                          </span>
                          <p className="text-xs font-barlow font-bold text-white leading-tight">{program.title}</p>
                        </div>
                      </div>
                      <div className="p-2.5 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground leading-tight">{program.aim}</p>
                        <div className="flex flex-wrap gap-1">
                          {program.targeted_areas.slice(0, 2).map(area => (
                            <span key={area} className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">{area}</span>
                          ))}
                          {program.targeted_areas.length > 2 && (
                            <span className="text-[9px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded">+{program.targeted_areas.length - 2}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock size={9} /> {program.duration}m
                          </span>
                          <span className={`text-[9px] font-semibold ${DIFFICULTY_COLORS[program.difficulty]}`}>{program.difficulty}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-2 text-center py-16">
                  <p className="text-muted-foreground text-sm">No programs match your filters.</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "saved" && (
          <div>
            {!isPremium ? (
              <div className="gradient-gold rounded-2xl p-6 text-center gold-glow mt-4">
                <Bookmark size={28} className="text-primary-foreground mx-auto mb-3" />
                <h3 className="text-xl font-barlow font-bold text-primary-foreground uppercase mb-1">Premium Feature</h3>
                <p className="text-xs text-primary-foreground/80 mb-4">Upgrade to save your favorite programs.</p>
                <button className="bg-primary-foreground text-primary px-6 py-2.5 rounded-xl font-barlow font-bold uppercase text-sm">Upgrade — $9.99/mo</button>
              </div>
            ) : savedPrograms.length === 0 ? (
              <div className="text-center py-16">
                <Bookmark size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">Tap the bookmark icon on any program to save it.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedPrograms.map(program => (
                  <div key={program.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3 cursor-pointer" onClick={() => setSelected(program)}>
                    <img src={program.cover} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-barlow font-bold text-foreground uppercase truncate">{program.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{program.aim}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Clock size={9} />{program.duration}m</span>
                        <span className={`text-[9px] font-semibold ${DIFFICULTY_COLORS[program.difficulty]}`}>{program.difficulty}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "playlists" && (
          <div>
            {!isPremium ? (
              <div className="gradient-gold rounded-2xl p-6 text-center gold-glow mt-4">
                <ListVideo size={28} className="text-primary-foreground mx-auto mb-3" />
                <h3 className="text-xl font-barlow font-bold text-primary-foreground uppercase mb-1">Premium Feature</h3>
                <p className="text-xs text-primary-foreground/80 mb-4">Upgrade to create custom training playlists.</p>
                <button className="bg-primary-foreground text-primary px-6 py-2.5 rounded-xl font-barlow font-bold uppercase text-sm">Upgrade — $9.99/mo</button>
              </div>
            ) : (
              <>
                <button onClick={() => setShowCreatePlaylist(true)}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-primary/40 text-primary py-3 rounded-xl text-sm font-semibold mb-4">
                  <Plus size={15} /> Create Playlist
                </button>
                {playlists.length === 0 ? (
                  <div className="text-center py-12">
                    <ListVideo size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
                    <p className="text-sm text-muted-foreground">No playlists yet. Create your first one!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playlists.map(pl => (
                      <div key={pl.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ListVideo size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-barlow font-bold text-foreground uppercase">{pl.name}</p>
                          <p className="text-[10px] text-muted-foreground">{(pl.program_ids || []).length} programs</p>
                        </div>
                        <button onClick={() => deletePlaylist(pl.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Create Playlist Modal */}
      {showCreatePlaylist && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border p-6 animate-slide-up max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-barlow font-bold text-foreground uppercase">New Playlist</h3>
              <button onClick={() => setShowCreatePlaylist(false)} className="p-1.5 rounded-lg bg-secondary text-muted-foreground">
                <X size={16} />
              </button>
            </div>
            <input
              className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none mb-4"
              placeholder="Playlist name (e.g. Pre-season Prep)"
              value={playlistName}
              onChange={e => setPlaylistName(e.target.value)}
            />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Add Programs</p>
            <div className="space-y-2 mb-5">
              {PROGRAMS.map(p => {
                const included = playlistPrograms.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setPlaylistPrograms(prev => included ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${included ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                    <img src={p.cover} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-barlow font-bold text-foreground uppercase truncate">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground">{p.duration}m · {p.difficulty}</p>
                    </div>
                    {included && <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center flex-shrink-0"><span className="text-[8px] text-primary-foreground font-bold">✓</span></div>}
                  </button>
                );
              })}
            </div>
            <button onClick={createPlaylist} disabled={!playlistName}
              className="w-full gradient-gold text-primary-foreground py-3.5 rounded-2xl font-barlow font-bold uppercase text-base gold-glow disabled:opacity-50">
              Create Playlist ({playlistPrograms.length} programs)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}