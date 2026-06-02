import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const TIME_RANGES = ["All", "<20m", "20–35m", "35m+"];
const MUSCLE_GROUPS = ["All", "Legs", "Core", "Upper Body", "Shoulders", "Glutes", "Full Body"];
const AIMS = ["All", "Strength", "Speed", "Recovery", "Endurance", "Skill", "Nutrition"];
const DIFFICULTIES = ["All", "Beginner", "Intermediate", "Advanced"];
const SORT_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "duration-asc", label: "Shortest First" },
  { value: "duration-desc", label: "Longest First" },
];

export default function PlaybookFilters({ filters, onFilterChange, resultCount }) {
  const [showDrawer, setShowDrawer] = useState(false);

  const update = (key, val) => onFilterChange({ ...filters, [key]: val });

  const activeCount = [
    filters.timeRange !== "All",
    filters.muscleGroup !== "All",
    filters.aim !== "All",
    filters.difficulty !== "All",
  ].filter(Boolean).length;

  const clearAll = () => onFilterChange({
    ...filters,
    timeRange: "All",
    muscleGroup: "All",
    aim: "All",
    difficulty: "All",
    sortBy: "default",
  });

  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setShowDrawer(true)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            activeCount > 0
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-secondary text-muted-foreground border-transparent"
          }`}
        >
          <SlidersHorizontal size={11} />
          Filter {activeCount > 0 && `(${activeCount})`}
        </button>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
          {AIMS.slice(1).map(aim => (
            <button key={aim} onClick={() => update("aim", filters.aim === aim ? "All" : aim)}
              className={`flex-shrink-0 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                filters.aim === aim ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              }`}>
              {aim}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">{resultCount} programs</span>
        <select
          value={filters.sortBy}
          onChange={e => update("sortBy", e.target.value)}
          className="bg-secondary text-xs text-foreground rounded-lg px-2 py-1 outline-none"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {showDrawer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card rounded-t-3xl border-t border-border p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-barlow font-bold text-foreground uppercase">Filter Programs</h3>
              <div className="flex items-center gap-3">
                {activeCount > 0 && (
                  <button onClick={clearAll} className="text-xs text-primary font-semibold">Clear All</button>
                )}
                <button onClick={() => setShowDrawer(false)} className="p-1.5 rounded-lg bg-secondary text-muted-foreground">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto max-h-[55vh]">
              {[
                { label: "Duration", key: "timeRange", options: TIME_RANGES },
                { label: "Targeted Areas", key: "muscleGroup", options: MUSCLE_GROUPS },
                { label: "Aim", key: "aim", options: AIMS },
                { label: "Difficulty", key: "difficulty", options: DIFFICULTIES },
              ].map(({ label, key, options }) => (
                <div key={key}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {options.map(opt => (
                      <button key={opt} onClick={() => update(key, opt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          filters[key] === opt
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}>{opt}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowDrawer(false)}
              className="w-full mt-5 bg-primary text-primary-foreground py-3 rounded-xl font-barlow font-bold uppercase text-sm">
              Show {resultCount} Results
            </button>
          </div>
        </div>
      )}
    </>
  );
}