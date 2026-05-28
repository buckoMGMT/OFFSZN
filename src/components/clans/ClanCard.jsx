import { Users, Trophy, Shield } from "lucide-react";

const typeLabel = {
  high_school: "High School",
  club: "Club",
  college: "College",
  other: "Team",
};

export default function ClanCard({ clan, onClick, isJoined }) {
  return (
    <button
      onClick={onClick}
      className={`w-full gradient-card border rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 text-left ${
        isJoined ? "border-primary/50 bg-primary/5" : "border-border hover:border-primary/30"
      }`}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isJoined ? "bg-primary/20" : "bg-secondary"}`}>
        {clan.emblem_url ? (
          <img src={clan.emblem_url} alt="" className="w-full h-full rounded-2xl object-cover" />
        ) : (
          <Shield size={24} className={isJoined ? "text-primary" : "text-muted-foreground"} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-barlow font-bold text-foreground uppercase truncate">{clan.name}</h3>
          {isJoined && <span className="text-[10px] font-barlow font-bold text-primary uppercase bg-primary/15 px-2 py-0.5 rounded-full">Joined</span>}
        </div>
        <p className="text-xs text-muted-foreground font-barlow uppercase tracking-wide mt-0.5">
          {typeLabel[clan.type]} {clan.sport ? `· ${clan.sport}` : ""}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users size={12} />
            <span className="text-xs">{(clan.member_ids || []).length} members</span>
          </div>
          <div className="flex items-center gap-1 text-primary">
            <Trophy size={12} />
            <span className="text-xs font-barlow font-bold">{clan.total_points || 0} pts</span>
          </div>
        </div>
      </div>
    </button>
  );
}