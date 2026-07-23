// Onboarding draft persistence (pre-launch item 2.1).
// All 12 steps previously lived in useState — a refresh or app-switch wiped
// everything the user typed. One sessionStorage blob mirrors the flow;
// restored on mount, cleared the moment the athlete record is created.
// In the native shell, drafts also write through to Capacitor Preferences,
// which survives app kills (initNativeShell hydrates it back on boot).
import { persistDraftNative, clearDraftNative } from "@/lib/native";

const KEY = "offszn.onboarding.draft";

export function readDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDraft(patch) {
  try {
    const json = JSON.stringify({ ...readDraft(), ...patch });
    sessionStorage.setItem(KEY, json);
    persistDraftNative(json);
  } catch { /* storage full/blocked — persistence is best-effort */ }
}

export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  clearDraftNative();
}
