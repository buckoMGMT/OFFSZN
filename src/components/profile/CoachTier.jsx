import { Video, Star } from "lucide-react";
import { Link } from "react-router-dom";

// Coach Tier progress card. Video uploads live in the Studio tab (Studio → Content → New Drill).
export default function CoachTier({ athlete }) {
  const approvedCount = athlete?.approved_video_count || 0;
  const totalViews = athlete?.total_video_views || 0;
  const isCoach = athlete?.is_coach_verified;
  const coachUnlocked = approvedCount >= 10 && totalViews >= 5000;

  return (
    <div className="space-y-3">
      {/* Coach Status Card */}
      <div className={`rounded-xl border p-4 ${isCoach ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Star size={16} className={isCoach ? "text-primary" : "text-muted-foreground"} />
            <span className="text-sm font-semibold text-foreground">
              {isCoach ? "Verified Coach ✓" : "Coach Tier"}
            </span>
          </div>
          {!isCoach && coachUnlocked && (
            <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold">Eligible!</span>
          )}
        </div>

        {/* Progress */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-secondary rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-foreground">{approvedCount}<span className="text-xs text-muted-foreground font-normal">/10</span></p>
            <p className="text-[10px] text-muted-foreground">Approved Videos</p>
          </div>
          <div className="bg-secondary rounded-lg p-2.5 text-center">
            <p className="text-xl font-bold text-foreground">
              {totalViews >= 1000 ? `${(totalViews / 1000).toFixed(1)}K` : totalViews}
              <span className="text-xs text-muted-foreground font-normal">/5K</span>
            </p>
            <p className="text-[10px] text-muted-foreground">Total Views</p>
          </div>
        </div>

        {/* Progress bars */}
        <div className="space-y-1.5 mb-3">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (approvedCount / 10) * 100)}%` }} />
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (totalViews / 5000) * 100)}%` }} />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {isCoach
            ? "You earn 70% of revenue on your approved training videos."
            : coachUnlocked
            ? "You've hit the threshold! Your Coach badge is being reviewed."
            : "Upload 10 approved videos with 5,000+ total views to unlock Coach Tier and earn revenue from your content."}
        </p>
      </div>

      {/* Uploads happen in the Studio */}
      <Link to="/studio"
        className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-primary/40 text-primary text-sm font-semibold rounded-xl hover:bg-primary/5 transition-colors">
        <Video size={15} /> Upload videos in your Studio →
      </Link>
    </div>
  );
}