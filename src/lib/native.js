// Native shell bridge (guideline-4.2 hardening) — every call is a safe no-op
// on the plain web build. One import site per capability, so the web bundle
// and the wrapped app share one codebase.
import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Share } from "@capacitor/share";
import { Preferences } from "@capacitor/preferences";

export const isNative = () => Capacitor.isNativePlatform();

// Success haptic — PR verified, streak extended, milestone hit.
export async function hapticSuccess() {
  try {
    if (isNative()) await Haptics.notification({ type: NotificationType.Success });
    else if (navigator.vibrate) navigator.vibrate(30);
  } catch { /* haptics are garnish — never break the moment */ }
}

// Native share fallback for when Web Share can't take files (old WKWebView).
export async function shareFallback({ title, text, url }) {
  if (!isNative()) return false;
  try {
    await Share.share({ title, text, url, dialogTitle: title });
    return true;
  } catch {
    return false;
  }
}

const DRAFT_KEY = "offszn.onboarding.draft";

// Boot the native shell: status bar to match surface-0, hide splash once the
// web app has painted, and hydrate the onboarding draft from native storage
// (Preferences survives app kills; sessionStorage in WKWebView does not).
export async function initNativeShell() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0A0B0D" });
    }
  } catch { /* status bar styling is cosmetic */ }
  try {
    const { value } = await Preferences.get({ key: DRAFT_KEY });
    if (value && !sessionStorage.getItem(DRAFT_KEY)) {
      sessionStorage.setItem(DRAFT_KEY, value);
    }
  } catch { /* draft hydration is best-effort */ }
  try { await SplashScreen.hide(); } catch { /* auto-hide covers this */ }
}

// Write-through used by onboardingDraft.js — fire-and-forget.
export function persistDraftNative(json) {
  if (!isNative()) return;
  Preferences.set({ key: DRAFT_KEY, value: json }).catch(() => {});
}

export function clearDraftNative() {
  if (!isNative()) return;
  Preferences.remove({ key: DRAFT_KEY }).catch(() => {});
}
