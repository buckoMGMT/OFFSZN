import { useRef, useState, useEffect } from "react";
import { X, ZoomIn } from "lucide-react";

// Square crop modal — drag to position, slider to zoom, canvas export.
// Returns a cropped Blob via onCropped. No external crop library needed.
export default function ImageCropModal({ file, onCropped, onClose }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [img, setImg] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef(null);
  const VIEW = 280; // square viewport px

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const i = new window.Image();
    i.onload = () => setImg(i);
    i.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Base scale fills the square viewport (cover)
  const baseScale = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1;
  const scale = baseScale * zoom;

  const clampOffset = (o, z = zoom) => {
    if (!img) return o;
    const s = baseScale * z;
    const maxX = Math.max(0, (img.width * s - VIEW) / 2);
    const maxY = Math.max(0, (img.height * s - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
  };

  const startDrag = (cx, cy) => { dragRef.current = { sx: cx, sy: cy, ox: offset.x, oy: offset.y }; };
  const moveDrag = (cx, cy) => {
    if (!dragRef.current) return;
    const d = dragRef.current;
    setOffset(clampOffset({ x: d.ox + (cx - d.sx), y: d.oy + (cy - d.sy) }));
  };
  const endDrag = () => { dragRef.current = null; };

  const confirm = async () => {
    if (!img) return;
    setSaving(true);
    const OUT = 512;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    const ratio = OUT / VIEW;
    // Image top-left in viewport coords
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    const left = (VIEW - drawW) / 2 + offset.x;
    const top = (VIEW - drawH) / 2 + offset.y;
    ctx.drawImage(img, left * ratio, top * ratio, drawW * ratio, drawH * ratio);
    canvas.toBlob(blob => {
      onCropped(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-5" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl p-4 overlay-shadow" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-strong)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-anton text-sm uppercase" style={{ color: 'var(--text-primary)' }}>Crop Photo</p>
          <button onClick={onClose} className="p-1 rounded" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-subtle)' }}>
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div
          className="mx-auto rounded-lg overflow-hidden relative"
          style={{ width: VIEW, height: VIEW, background: 'var(--surface-0)', border: '1px solid var(--border-subtle)', touchAction: 'none', cursor: 'grab' }}
          onMouseDown={e => startDrag(e.clientX, e.clientY)}
          onMouseMove={e => moveDrag(e.clientX, e.clientY)}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchMove={e => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
          onTouchEnd={endDrag}
        >
          {imgUrl && img && (
            <img
              src={imgUrl}
              alt=""
              draggable={false}
              style={{
                position: 'absolute',
                width: img.width * scale,
                height: img.height * scale,
                maxWidth: 'none',
                left: (VIEW - img.width * scale) / 2 + offset.x,
                top: (VIEW - img.height * scale) / 2 + offset.y,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-4 mb-4">
          <ZoomIn size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            type="range" min="1" max="3" step="0.05" value={zoom}
            onChange={e => { const z = Number(e.target.value); setZoom(z); setOffset(o => clampOffset(o, z)); }}
            className="flex-1"
            style={{ accentColor: 'var(--accent)' }}
          />
        </div>

        <button className="btn-primary w-full" onClick={confirm} disabled={saving || !img}>
          {saving ? "Saving…" : "Use Photo"}
        </button>
      </div>
    </div>
  );
}