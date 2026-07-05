import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, Play, Clock, Target, Bookmark, BookmarkCheck, Plus, X, ListVideo } from "lucide-react";
import ProtectedVideoPlayer from "@/components/feed/ProtectedVideoPlayer";
import PremiumGate from "@/components/ui/PremiumGate";
import PageLabel from "@/components/ui/PageLabel";
import StampButton from "@/components/ui/StampButton";
import PlayDiagram from "@/components/ui/PlayDiagram";
import ExploreGrid from "@/components/playbook/ExploreGrid";
import PassPaywallSheet from "@/components/monetization/PassPaywallSheet";
import PassRibbon from "@/components/monetization/PassRibbon";

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
  { id: 13, title: "Top 5 Speed Drills — Football", sport: "Football", duration: 14, isPremium: false, category: "Speed", aim: "Explosive sprint starts & acceleration", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Coach Dane Miller's 5 bodyweight speed exercises. A-Skips, Dions, Bounds, Tuck Jumps & Hill Sprints.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "RB, WR, DB, LB" },
  { id: 14, title: "Top 5 Speed Drills — Soccer", sport: "Soccer", duration: 14, isPremium: false, category: "Speed", aim: "Sprint speed and acceleration for all positions", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "5 bodyweight sprint drills to dominate the pitch.", cover: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "All Positions" },
  { id: 15, title: "Top 5 Speed Drills — Basketball", sport: "Basketball", duration: 14, isPremium: false, category: "Speed", aim: "First-step quickness and sprint speed", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Improve court speed and transition explosiveness.", cover: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "Guards, Wings" },
  { id: 16, title: "Top 5 Speed Drills — Baseball", sport: "Baseball", duration: 14, isPremium: false, category: "Speed", aim: "Base-running speed and outfield acceleration", targeted_areas: ["Legs", "Glutes", "Core"], difficulty: "Intermediate", description: "Bodyweight sprint mechanics for faster base running.", cover: "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&q=80", timing: "Pre-workout", video_url: "https://www.youtube.com/watch?v=tHv9DcfawsA", positions: "Base Runners, Fielders" },
];

// Tiny X's/O's icon for program cards
function XsOs({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="8" cy="8" r="4" stroke="#9BA3AC" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="8" r="4" stroke="#9BA3AC" strokeWidth="1.5" fill="none" />
      <line x1="5" y1="19" x2="11" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="11" y1="19" x2="5" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="17" y1="19" x2="23" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
      <line x1="23" y1="19" x2="17" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function difficultyNum(d) {
  return d === "Beginner" ? "01" : d === "Intermediate" ? "02" : "03";
}

export default function Playbook() {
  const [athlete, setAthlete] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [savedIds, setSavedIds] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [tab, setTab] = useState("explore");
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [playlistPrograms, setPlaylistPrograms] = useState([]);
  const [showPaywall, setShowPaywall] = useState(false);

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
    setShowCreatePlaylist(false); setPlaylistName(""); setPlaylistPrograms([]);
  };

  const filtered = PROGRAMS.filter(p => sportFilter === "All" || p.sport === sportFilter);
  const savedPrograms = PROGRAMS.filter(p => savedIds.includes(p.id));

  // Detail view
  if (selected) {
    const isSaved = savedIds.includes(selected.id);
    const locked = selected.isPremium && !isPremium;
    return (
      <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
        <div className="relative h-52 w-full overflow-hidden">
          <img src={selected.cover} alt={selected.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--theme-bg) 10%, transparent 80%)' }} />
          <button onClick={() => setSelected(null)}
            className="absolute top-14 left-4 font-elite text-xs uppercase tracking-widest px-3 py-1.5 rounded"
            style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}>
            ← Back
          </button>
          {isPremium && (
            <button onClick={(e) => toggleSave(selected, e)}
              className="absolute top-14 right-4 p-2 rounded"
              style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)' }}>
              {isSaved ?               <BookmarkCheck size={16} style={{ color: 'var(--accent)' }} /> : <Bookmark size={16} style={{ color: '#5A5D63' }} />}
            </button>
          )}
        </div>

        <div className="px-4 -mt-6 relative z-10 pb-8">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h1 className="font-anton text-2xl uppercase leading-tight" style={{ color: locked ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
              {locked ? "All-SZN Program" : selected.title}
            </h1>
            <span className="ink-stamp mt-1.5 flex-shrink-0">LVL {difficultyNum(selected.difficulty)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4" style={{ color: 'var(--text-tertiary)' }}>
            <span className="font-elite text-[10px] uppercase flex items-center gap-1"><Clock size={10} /> {selected.duration} min</span>
            <span className="font-elite text-[10px] uppercase">{selected.timing}</span>
            {selected.positions && <span className="font-elite text-[10px] uppercase">{selected.positions}</span>}
          </div>

          <div className="card-base p-3 mb-3 flex items-start gap-2">
            <Target size={13} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <p className="eyebrow mb-0.5">Aim</p>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{locked ? "Premium access required" : selected.aim}</p>
            </div>
          </div>

          <div className="card-base p-3 mb-4">
            <p className="eyebrow mb-2">Targeted Areas</p>
            <div className="flex flex-wrap gap-1.5">
              {selected.targeted_areas.map(area => (
                <span key={area} className="px-2 py-1 rounded font-elite text-[10px] uppercase" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{area}</span>
              ))}
            </div>
          </div>

          <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>

          {selected.video_url && !locked && (
            <div className="mb-6">
              <ProtectedVideoPlayer url={selected.video_url} />
            </div>
          )}

          {locked ? (
            <PremiumGate
              title="All-SZN Pass Required"
              subtitle="The full library opens with the All-SZN Pass."
              onUpgrade={() => setShowPaywall(true)}
            />
          ) : (
            <div className="flex justify-center">
              <button className="btn-primary" style={{ fontSize: 'var(--text-base)', padding: '12px 40px' }}>
                <Play size={14} fill="currentColor" /> Start Program
              </button>
            </div>
          )}
        </div>
        <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'transparent', color: 'var(--theme-ink)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-4 pt-12 pb-3 border-b" style={{ background: 'rgba(10,11,13,0.72)', borderColor: 'var(--border-subtle)', backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-anton text-3xl uppercase" style={{ color: 'var(--text-primary)' }}>Drills</h1>
          <PageLabel number={3} />
        </div>
        <p className="eyebrow mb-3">Training Programs — Select a Drill</p>

        {/* Tab bar */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          {[
            { id: "explore", label: "Explore" },
            { id: "saved", label: `Saved${savedIds.length ? ` (${savedIds.length})` : ""}` },
            { id: "playlists", label: "Playlists" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex-1 py-2 font-elite text-xs uppercase tracking-widest"
              style={{
                color: tab === t.id ? 'var(--accent)' : 'var(--text-tertiary)',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "explore" && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide py-2">
            {SPORT_FILTERS.map(sport => (
              <button key={sport} onClick={() => setSportFilter(sport)}
                className="flex-shrink-0 px-3 py-1 rounded font-elite text-[10px] uppercase tracking-widest transition-all"
                style={{
                  background: sportFilter === sport ? 'var(--accent)' : 'var(--surface-1)',
                  color: sportFilter === sport ? 'var(--on-accent)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}>
                {sport}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {tab === "explore" && (
          <ExploreGrid
            programs={filtered}
            sportFilter={sportFilter}
            isPremium={isPremium}
            onSelectProgram={setSelected}
            onLockedProgram={() => setShowPaywall(true)}
          />
        )}

        {tab === "saved" && (
          <div>
            {!isPremium ? (
              <div className="mt-4">
                <PremiumGate title="Saved Programs" subtitle="Save your favorite drills and build custom playlists with the All-SZN Pass." onUpgrade={() => setShowPaywall(true)} />
              </div>
            ) : savedPrograms.length === 0 ? (
              <div className="text-center py-16">
                <PlayDiagram size={130} />
                <p className="font-work text-sm mt-4" style={{ color: '#5A5D63' }}>Tap the bookmark icon on any program to save it.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedPrograms.map(program => (
                  <div key={program.id} className="rounded border p-3 flex items-center gap-3 cursor-pointer" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }} onClick={() => setSelected(program)}>
                    <img src={program.cover} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" style={{ border: '1px solid var(--theme-border)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-sm font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{program.title}</p>
                      <p className="font-elite text-[9px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--theme-ink-soft)' }}>{program.duration}m · LVL {difficultyNum(program.difficulty)}</p>
                    </div>
                    <span className="font-elite text-[9px]" style={{ color: 'var(--theme-border)' }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "playlists" && (
          <div>
            {!isPremium ? (
              <div className="mt-4">
                <PremiumGate title="Custom Playlists" subtitle="Create and organize your own training playlists with the All-SZN Pass." onUpgrade={() => setShowPaywall(true)} />
              </div>
            ) : (
              <>
                <div className="mb-4 flex justify-center">
                  <StampButton onClick={() => setShowCreatePlaylist(true)}>
                    <Plus size={12} /> New Playlist
                  </StampButton>
                </div>
                {playlists.length === 0 ? (
                  <div className="text-center py-12">
                    <PlayDiagram size={120} />
                    <p className="font-work text-sm mt-4" style={{ color: '#5A5D63' }}>No playlists yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {playlists.map(pl => (
                      <div key={pl.id} className="rounded border p-4 flex items-center gap-3" style={{ background: 'var(--theme-surface)', borderColor: 'var(--theme-border)' }}>
                        <XsOs size={32} />
                        <div className="flex-1 min-w-0">
                          <p className="font-work font-semibold" style={{ color: 'var(--theme-ink)' }}>{pl.name}</p>
                          <p className="font-elite text-[9px] uppercase tracking-widest" style={{ color: 'var(--theme-ink-soft)' }}>{(pl.program_ids || []).length} programs</p>
                        </div>
                        <button onClick={() => base44.entities.Playlist.delete(pl.id).then(() => setPlaylists(p => p.filter(x => x.id !== pl.id)))}>
                          <X size={14} style={{ color: '#9BA3AC' }} />
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
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-lg rounded-t-2xl border-t border-l border-r p-6 animate-slide-up max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--theme-bg)', borderColor: 'var(--theme-border)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-anton text-xl uppercase" style={{ color: 'var(--theme-ink)' }}>New Playlist</h3>
              <button onClick={() => setShowCreatePlaylist(false)} className="p-1.5 rounded" style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}>
                <X size={16} style={{ color: 'var(--theme-ink-soft)' }} />
              </button>
            </div>
            <input className="w-full rounded px-4 py-3 text-sm font-work outline-none mb-4"
              style={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border)', color: 'var(--theme-ink)' }}
              placeholder="Playlist name"
              value={playlistName} onChange={e => setPlaylistName(e.target.value)} />
            <p className="font-elite text-[9px] uppercase tracking-widest mb-2" style={{ color: 'var(--theme-ink-soft)' }}>Add Programs</p>
            <div className="space-y-2 mb-5">
              {PROGRAMS.map(p => {
                const included = playlistPrograms.includes(p.id);
                return (
                  <button key={p.id} onClick={() => setPlaylistPrograms(prev => included ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                    className="w-full flex items-center gap-3 p-2.5 rounded border text-left"
                    style={{ border: included ? '2px solid var(--accent)' : '1px solid var(--theme-border)', background: included ? 'var(--accent-subtle)' : 'var(--theme-surface)' }}>
                    <img src={p.cover} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-work text-xs font-semibold truncate" style={{ color: 'var(--theme-ink)' }}>{p.title}</p>
                      <p className="font-elite text-[9px] uppercase" style={{ color: 'var(--theme-ink-soft)' }}>{p.duration}m</p>
                    </div>
                    {included && <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-center">
              <StampButton onClick={createPlaylist} disabled={!playlistName}>
                Create ({playlistPrograms.length} programs)
              </StampButton>
            </div>
          </div>
        </div>
      )}

      <PassPaywallSheet open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  );
}