// User-customizable accent color — overrides the Cone Orange tokens app-wide.
// Default stays #FF5A1F; custom picks persist in localStorage and apply on boot.
export const DEFAULT_ACCENT = '#FF5A1F';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const c = v => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function applyAccent(hex) {
  const root = document.documentElement;
  const { r, g, b } = hexToRgb(hex);
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent-hover', shade(hex, 18));
  root.style.setProperty('--accent-pressed', shade(hex, -18));
  root.style.setProperty('--accent-subtle', `rgba(${r},${g},${b},0.12)`);
  // Keep button text readable on light vs dark accents
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  root.style.setProperty('--on-accent', lum > 160 ? '#0A0B0D' : '#F5F5F0');
  localStorage.setItem('pb_accent', hex);
}

export function resetAccent() {
  localStorage.removeItem('pb_accent');
  ['--accent', '--accent-hover', '--accent-pressed', '--accent-subtle', '--on-accent']
    .forEach(v => document.documentElement.style.removeProperty(v));
}

// Apply a saved custom accent as early as possible (splash screen included).
export function initAccent() {
  const saved = localStorage.getItem('pb_accent');
  if (saved && saved !== DEFAULT_ACCENT) applyAccent(saved);
}