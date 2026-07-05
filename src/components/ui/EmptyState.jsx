/* Empty state component — §5: every empty state gets icon + athlete-voice copy + action.
   No blank screens anywhere. */
import PlayDiagram from "@/components/ui/PlayDiagram";

export default function EmptyState({ icon: Icon, title, body, action, onAction }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-16 px-5"
      style={{ gap: 16 }}
    >
      {Icon
        ? <Icon size={48} style={{ color: 'var(--text-tertiary)', strokeWidth: 1.5 }} />
        : <PlayDiagram size={140} />
      }
      {title && (
        <p
          style={{
            fontFamily: "'Archivo Black', sans-serif",
            fontSize: 'var(--text-xl)',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            lineHeight: 1.1,
            maxWidth: '28ch',
          }}
        >
          {title}
        </p>
      )}
      {body && (
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '32ch', lineHeight: 1.5 }}>
          {body}
        </p>
      )}
      {action && onAction && (
        <button className="btn-stamp mt-2" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}