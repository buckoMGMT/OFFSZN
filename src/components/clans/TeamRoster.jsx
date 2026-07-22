import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { UserPlus } from "lucide-react";
import RosterRow from "@/components/clans/RosterRow";
import AthleteProfileSheet from "@/components/profile/AthleteProfileSheet";

// Roster list of the athlete's own team members — jersey-number rows.
// Bottom CTA invites athletes (share the join code / native share).
export default function TeamRoster({ clan, athleteId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openAthlete, setOpenAthlete] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!clan?.id) return;
    base44.entities.Athlete.filter({ clan_id: clan.id }, "-total_points", 50).then(list => {
      setMembers(list);
      setLoading(false);
    });
  }, [clan?.id]);

  const invite = async () => {
    const text = `Join ${clan.name} on OFFSZN — search the team name in Teams to hop on the roster.`;
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch { /* cancelled */ }
    }
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  };

  if (loading) return <div className="skeleton mb-6" style={{ height: 120 }} />;

  return (
    <div className="mb-6">
      <div className="space-y-2">
        {members.map((m, i) => (
          <RosterRow key={m.id} member={m} index={i} isMe={m.id === athleteId} onOpen={setOpenAthlete} />
        ))}
      </div>

      {/* Invite CTA — accent-outline, image-6 style */}
      <button onClick={invite}
        className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded font-elite text-[11px] uppercase tracking-widest"
        style={{ background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
        <UserPlus size={14} /> {copied ? "Copied Invite" : "Invite Athletes"}
      </button>

      <AthleteProfileSheet open={!!openAthlete} onClose={() => setOpenAthlete(null)} athlete={openAthlete} />
    </div>
  );
}