// Blocked-user cache — one fetch per session, shared across surfaces.
// Server is the source of truth (blockUser function); this only filters UI.
import { base44 } from "@/api/base44Client";

let blockedIds = null; // Set<string> once loaded
let inflight = null;
const listeners = new Set();

export async function loadBlockedIds() {
  if (blockedIds) return blockedIds;
  if (!inflight) {
    inflight = base44.functions.invoke("blockUser", { action: "list" })
      .then(({ data }) => {
        blockedIds = new Set(data?.blocked_ids || []);
        return blockedIds;
      })
      .catch(() => {
        // Fail open for UI filtering — server still enforces threads.
        blockedIds = new Set();
        return blockedIds;
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function isBlocked(athleteId) {
  return !!blockedIds && blockedIds.has(athleteId);
}

export function getBlockedIds() {
  return blockedIds || new Set();
}

export async function blockAthlete(athleteId) {
  await base44.functions.invoke("blockUser", { action: "block", targetAthleteId: athleteId });
  if (!blockedIds) blockedIds = new Set();
  blockedIds.add(athleteId);
  listeners.forEach((fn) => fn(getBlockedIds()));
}

export async function unblockAthlete(athleteId) {
  await base44.functions.invoke("blockUser", { action: "unblock", targetAthleteId: athleteId });
  if (blockedIds) blockedIds.delete(athleteId);
  listeners.forEach((fn) => fn(getBlockedIds()));
}

// Subscribe to block-list changes (e.g. Feed refilters after a block).
export function onBlocksChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
