// The primary CTA signature — now with native haptic-feel tap.
import { useState } from "react";
import { motion } from "framer-motion";

export default function StampButton({ children, onClick, disabled, className = "", fullWidth = false }) {
  const [pressing, setPressing] = useState(false);

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.12, ease: [0.2, 0, 0, 1] }}
      className={`btn-stamp ${pressing ? "stamped" : ""} ${fullWidth ? "w-full" : ""} ${className}`}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => { setPressing(false); onClick?.(); }}
      onTouchStart={() => setPressing(true)}
      onTouchEnd={() => { setPressing(false); onClick?.(); }}
      disabled={disabled}
      style={{ opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {children}
    </motion.button>
  );
}