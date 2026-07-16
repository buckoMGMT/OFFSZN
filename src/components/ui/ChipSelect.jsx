// App-styled chip-group select — replaces native <select> elements so pickers
// feel native instead of web forms. options: array of strings or [value, label].
export default function ChipSelect({ label, options, value, onChange }) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o.replace(/_/g, " ")]));
  return (
    <div>
      {label && (
        <span className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
          {label}
        </span>
      )}
      <div className="flex flex-wrap gap-2">
        {opts.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className="px-3 py-2 rounded font-work text-[11px] font-semibold capitalize"
            style={
              value === v
                ? { background: "var(--accent-subtle)", border: "1px solid var(--accent)", color: "var(--text-primary)" }
                : { background: "var(--surface-1)", border: "1px solid var(--border-subtle)", color: "var(--text-secondary)" }
            }
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}