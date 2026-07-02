// Single swappable wordmark — swap the final logo here when ready.
// Usage: <BrandMark size="lg" /> or <BrandMark size="sm" />
export default function BrandMark({ size = "md", className = "" }) {
  const sizes = {
    sm: "text-xl tracking-widest",
    md: "text-3xl tracking-widest",
    lg: "text-5xl tracking-widest",
  };
  return (
    <span className={`font-anton uppercase leading-none ${sizes[size] || sizes.md} ${className}`}>
      <span style={{ color: '#F5F5F0' }}>OFF</span>
      <span style={{ color: '#00C853' }}>SZN</span>
    </span>
  );
}