// Photographic hero band — the image-6 signature. A background image (athlete
// photo / team banner / drill thumbnail) scrimmed to tokens so overlaid text
// always passes contrast, with an optional ghosted number/word behind the title.
// Falls back to a dark gradient placeholder when no image exists.
export default function PageHero({ imageUrl, ghost, height = 200, children, rounded = false }) {
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height,
        borderRadius: rounded ? 'var(--r-lg)' : 0,
        background: 'linear-gradient(150deg, var(--surface-2) 0%, var(--surface-0) 70%)',
      }}
    >
      {imageUrl && (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
      )}
      {/* Ghosted number/word behind the title — 12% white, the image-6 look */}
      {ghost != null && String(ghost).length > 0 && (
        <span
          aria-hidden
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            fontFamily: "'Archivo Black', sans-serif", lineHeight: 1,
            fontSize: height >= 200 ? 150 : 110, color: 'rgba(255,255,255,0.10)',
            letterSpacing: '-0.03em', pointerEvents: 'none', userSelect: 'none',
          }}
        >
          {String(ghost).slice(0, 3)}
        </span>
      )}
      {/* Token-scrimmed bottom gradient — text below always readable */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, var(--surface-0) 4%, rgba(10,11,13,0.35) 45%, transparent 85%)' }} />
      {/* Content sits at the bottom over the scrim */}
      <div className="absolute inset-x-0 bottom-0 p-4">{children}</div>
    </div>
  );
}