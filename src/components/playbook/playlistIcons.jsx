// Playlist icon vocabulary — lucide only, shared by the create sheet and detail view.
import { Dumbbell, Zap, Flame, Timer, Footprints, Trophy, Bike, HeartPulse } from "lucide-react";

export const PLAYLIST_ICONS = {
  dumbbell: Dumbbell,
  zap: Zap,
  flame: Flame,
  timer: Timer,
  run: Footprints,
  trophy: Trophy,
  bike: Bike,
  heart: HeartPulse,
};

export const DEFAULT_PLAYLIST_ICON = "dumbbell";

export function PlaylistIcon({ name, size = 20, color = "var(--accent)" }) {
  const Icon = PLAYLIST_ICONS[name] || Dumbbell;
  return <Icon size={size} style={{ color }} />;
}