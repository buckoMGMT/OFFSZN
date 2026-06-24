// The primary CTA signature: ink-stamp style button
// Transparent with red border at -2°, fills solid red on press
import { useState } from "react";

export default function StampButton({ children, onClick, disabled, className = "", fullWidth = false }) {
  const [pressing, setPressing] = useState(false);

  return (
    <button
      className={`btn-stamp ${pressing ? "stamped" : ""} ${fullWidth ? "w-full" : ""} ${className}`}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => { setPressing(false); onClick?.(); }}
      onTouchStart={() => setPressing(true)}
      onTouchEnd={() => { setPressing(false); onClick?.(); }}
      disabled={disabled}
      style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </button>
  );
}