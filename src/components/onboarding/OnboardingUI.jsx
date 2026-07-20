// Shared onboarding primitives — one question per screen, endowed progress,
// back on every step (locked answers feel punishing).

export function ProgressBar({ filled, total }) {
  return (
    <div className="flex gap-1 w-full" role="progressbar"
         aria-valuenow={filled} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="h-1 flex-1 rounded-full"
             style={{ background: i < filled ? "var(--accent)" : "var(--surface-3)" }} />
      ))}
    </div>
  );
}

export function StepShell({ eyebrow, title, children, onBack, canBack }) {
  // Full-height flex shell: any `mt-auto` action block is pinned to the SAME
  // bottom position on every step, clear of the native home indicator.
  return (
    <div className="flex flex-col min-h-full px-5 pt-6 flex-1" style={{ maxWidth: 480, margin: "0 auto", width: "100%", paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
      {canBack && (
        <button onClick={onBack} aria-label="Back"
                className="self-start mb-4 text-tx-secondary text-sm font-medium">
          ← Back
        </button>
      )}
      <span className="eyebrow" style={{ color: "var(--accent)", letterSpacing: "0.14em" }}>{eyebrow}</span>
      <h1 className="font-display text-2xl text-tx-primary mt-2 mb-6" style={{ textWrap: "balance" }}>{title}</h1>
      {children}
    </div>
  );
}

export function PrimaryButton({ children, disabled, onClick, type = "button" }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className="w-full font-semibold text-base rounded-md transition-transform active:scale-[0.98] disabled:opacity-40"
      style={{ height: 52, background: "var(--accent)", color: "var(--on-accent)" }}>
      {children}
    </button>
  );
}

export function SkipButton({ onClick, children = "Skip — I'll do it later" }) {
  return (
    <button onClick={onClick} className="text-tx-tertiary text-sm font-medium py-2 w-full">
      {children}
    </button>
  );
}

export function Chip({ selected, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className="rounded-md text-sm font-medium px-4 transition-colors"
      style={{
        height: 44,
        background: selected ? "var(--accent-subtle)" : "var(--surface-1)",
        border: `1px solid ${selected ? "var(--accent)" : "var(--border-strong)"}`,
        color: selected ? "var(--accent)" : "var(--text-primary)",
      }}>
      {children}
    </button>
  );
}

export function Field({ label, hint, ...inputProps }) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-tx-secondary mb-2">{label}</span>
      <input {...inputProps}
        className="w-full rounded-md text-base px-4 text-tx-primary"
        style={{ height: 52, background: "var(--surface-1)", border: "1px solid var(--border-strong)" }} />
      {hint && <span className="block text-xs text-tx-tertiary mt-1">{hint}</span>}
    </label>
  );
}