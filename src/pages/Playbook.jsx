import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronRight, Lock, Play, Clock } from "lucide-react";

const SPORT_FILTERS = ["All", "Football", "Basketball", "Baseball", "Soccer", "Track", "Volleyball", "Wrestling", "Swimming"];

const PROGRAMS = [
  { id: 1, title: "Elite Linebacker Training", sport: "Football", duration: 45, isPremium: false, category: "Strength", description: "Full-body power program designed for linebackers.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80" },
  { id: 2, title: "Point Guard Explosiveness", sport: "Basketball", duration: 30, isPremium: false, category: "Speed", description: "Lateral quickness and first-step explosion drills.", cover: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80" },
  { id: 3, title: "D1 Pitcher Arm Care", sport: "Baseball", duration: 20, isPremium: true, category: "Recovery", description: "NCAA-level arm health and velocity program.", cover: "https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&q=80" },
  { id: 4, title: "Sprint Mechanics & Speed", sport: "Track", duration: 40, isPremium: false, category: "Speed", description: "Optimize your form and shave time off your 40.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80" },
  { id: 5, title: "Soccer Conditioning Block", sport: "Soccer", duration: 50, isPremium: true, category: "Endurance", description: "90-minute match stamina and agility builder.", cover: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&q=80" },
  { id: 6, title: "Volleyball Jump Program", sport: "Volleyball", duration: 35, isPremium: false, category: "Strength", description: "Increase your vertical by 4–6 inches in 8 weeks.", cover: "https://images.unsplash.com/photo-1592656094267-764a45160876?w=400&q=80" },
  { id: 7, title: "Wrestler Weight Cut Protocol", sport: "Wrestling", duration: 25, isPremium: true, category: "Nutrition", description: "Safe and legal weight management for competition.", cover: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&q=80" },
  { id: 8, title: "Swimmer Dryland Strength", sport: "Swimming", duration: 40, isPremium: false, category: "Strength", description: "Build the pulling strength and core power swimmers need.", cover: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80" },
  { id: 9, title: "Quarterback Pocket Presence", sport: "Football", duration: 30, isPremium: true, category: "Skill", description: "Decision-making, footwork, and release timing drills.", cover: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&q=80" },
  { id: 10, title: "Post Player Footwork", sport: "Basketball", duration: 35, isPremium: false, category: "Skill", description: "Dominate the paint with elite footwork patterns.", cover: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400&q=80" },
];

const CATEGORY_COLORS = {
  Strength: "bg-red-500/20 text-red-400",
  Speed: "bg-yellow-500/20 text-yellow-400",
  Recovery: "bg-blue-500/20 text-blue-400",
  Endurance: "bg-green-500/20 text-green-400",
  Nutrition: "bg-purple-500/20 text-purple-400",
  Skill: "bg-primary/20 text-primary",
};

export default function Playbook() {
  const [athlete, setAthlete] = useState(null);
  const [sportFilter, setSportFilter] = useState("All");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    base44.entities.Athlete.list("-created_date", 1).then(list => setAthlete(list[0] || null));
  }, []);

  const isPremium = athlete?.subscription_tier === "premium";

  const filtered = PROGRAMS.filter(p =>
    sportFilter === "All" || p.sport === sportFilter
  );

  if (selected) {
    return (
      <div className="min-h-screen bg-background">
        <div className="relative h-56 w-full overflow-hidden">
          <img src={selected.cover} alt={selected.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <button onClick={() => setSelected(null)}
            className="absolute top-14 left-4 bg-black/50 text-white rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
            ← Back
          </button>
          {selected.isPremium && !isPremium && (
            <div className="absolute top-14 right-4 bg-primary/90 text-primary-foreground rounded-full px-3 py-1.5 text-xs font-bold flex items-center gap-1">
              <Lock size={10} /> Premium
            </div>
          )}
        </div>
        <div className="px-4 -mt-8 relative z-10">
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${CATEGORY_COLORS[selected.category]}`}>
            {selected.category}
          </span>
          <h1 className="text-2xl font-barlow font-bold text-foreground uppercase mb-1">{selected.title}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
            <span>{selected.sport}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {selected.duration} min</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{selected.description}</p>

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
        {/* Sport Filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {SPORT_FILTERS.map(sport => (
            <button key={sport} onClick={() => setSportFilter(sport)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                sportFilter === sport
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}>
              {sport}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-4 py-4 columns-2 gap-3">
        {filtered.map(program => (
          <div key={program.id} className="break-inside-avoid mb-3 cursor-pointer" onClick={() => setSelected(program)}>
            <div className="relative rounded-xl overflow-hidden bg-card border border-border">
              <div className="relative">
                <img src={program.cover} alt={program.title} className="w-full object-cover" style={{ height: program.id % 3 === 0 ? 180 : 130 }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                {program.isPremium && (
                  <div className="absolute top-2 right-2 bg-primary/90 rounded-full p-1">
                    <Lock size={10} className="text-primary-foreground" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 ${CATEGORY_COLORS[program.category]}`}>
                    {program.category}
                  </span>
                  <p className="text-xs font-barlow font-bold text-white leading-tight">{program.title}</p>
                </div>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock size={9} /> {program.duration}m
                </div>
                <ChevronRight size={12} className="text-muted-foreground" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}