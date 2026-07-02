/* Single swappable wordmark — swap the final logo here when the asset is ready.
   Renders in Archivo Black (display face) with Cone Orange accent on the "SZN".
   Psychology: the wordmark IS identity — treat it with the same restraint as the
   primary button. Never color both halves the same; the contrast is the brand. */
export default function BrandMark({ size = "md", className = "" }) {
  const sizes = {
    sm: { fontSize: '1.25rem',  letterSpacing: '0.04em' },
    md: { fontSize: '1.75rem',  letterSpacing: '0.04em' },
    lg: { fontSize: '2.75rem',  letterSpacing: '0.04em' },
  };
  const style = sizes[size] || sizes.md;

  return (
    <span
      className={`leading-none select-none ${className}`}
      style={{
        fontFamily: "'Archivo Black', 'Anton', sans-serif",
        fontWeight: 900,
        ...style,
      }}
    >
      <span style={{ color: 'var(--text-primary)' }}>OFF</span>
      <span style={{ color: 'var(--accent)' }}>SZN</span>
    </span>
  );
}