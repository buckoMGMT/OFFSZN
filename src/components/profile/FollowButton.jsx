// Optimistic follow/unfollow — writes to MY athlete record's friends array,
// which the Feed's "Friends" tab already reads.
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { UserPlus, UserCheck } from "lucide-react";

export default function FollowButton({ me, targetId, onChange }) {
  const [friends, setFriends] = useState(me?.friends || []);
  const [busy, setBusy] = useState(false);
  if (!me || !targetId || me.id === targetId) return null;

  const following = friends.includes(targetId);

  const toggle = async () => {
    const prev = friends;
    const next = following ? prev.filter(id => id !== targetId) : [...prev, targetId];
    setFriends(next); // optimistic — flips instantly
    setBusy(true);
    try {
      await base44.entities.Athlete.update(me.id, { friends: next });
      onChange?.(next);
    } catch {
      setFriends(prev); // visible rollback on failure
    }
    setBusy(false);
  };

  return (
    <button onClick={toggle} disabled={busy} className={following ? "btn-secondary w-full" : "btn-primary w-full"} style={{ minHeight: 44 }}>
      {following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
    </button>
  );
}