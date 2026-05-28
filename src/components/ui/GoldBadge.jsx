export default function GoldBadge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-barlow font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 ${className}`}>
      {children}
    </span>
  );
}