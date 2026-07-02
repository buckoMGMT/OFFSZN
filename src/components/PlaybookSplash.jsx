import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// X's and O's route diagram SVG
function PlayDiagram() {
  return (
    <svg viewBox="0 0 220 140" className="w-full h-full opacity-90" fill="none">
      {/* Field lines */}
      <line x1="110" y1="10" x2="110" y2="130" stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="10" y1="80" x2="210" y2="80" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* LOS */}
      <line x1="20" y1="90" x2="200" y2="90" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />

      {/* Offense — O's */}
      {[
        [65, 90], [85, 90], [105, 88], [125, 90], [145, 90],
        [105, 70]
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7" stroke="white" strokeWidth="1.8" fill="none" opacity="0.75" />
      ))}

      {/* Defense — X's */}
      {[
        [60, 108], [85, 105], [110, 108], [135, 105], [155, 108],
        [90, 122], [130, 122]
      ].map(([cx, cy], i) => (
        <g key={i}>
          <line x1={cx-5} y1={cy-5} x2={cx+5} y2={cy+5} stroke="#D7263D" strokeWidth="2" opacity="0.85" />
          <line x1={cx+5} y1={cy-5} x2={cx-5} y2={cy+5} stroke="#D7263D" strokeWidth="2" opacity="0.85" />
        </g>
      ))}

      {/* Route lines */}
      <path d="M65 90 L40 60 L65 40" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" markerEnd="url(#arrow)" />
      <path d="M145 90 L170 60 L145 40" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
      <path d="M85 90 L75 65" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />
      <path d="M125 90 L140 65" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" strokeDasharray="3 3" />

      {/* Arrow QB to receiver */}
      <path d="M105 70 L65 42" stroke="#D7263D" strokeWidth="2" fill="none" opacity="0.8" markerEnd="url(#garrow)" />

      <defs>
        <marker id="garrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#D7263D" opacity="0.8" />
        </marker>
      </defs>
    </svg>
  );
}

// Scattered X's and O's background
function PlaybookBackground() {
  const items = [
    { type: "O", x: 8, y: 12, size: 28, rot: -12, op: 0.07 },
    { type: "X", x: 82, y: 8, size: 22, rot: 15, op: 0.06 },
    { type: "O", x: 92, y: 30, size: 18, rot: 5, op: 0.05 },
    { type: "X", x: 5, y: 55, size: 20, rot: -8, op: 0.06 },
    { type: "O", x: 75, y: 65, size: 32, rot: 20, op: 0.07 },
    { type: "X", x: 15, y: 80, size: 24, rot: -5, op: 0.05 },
    { type: "O", x: 88, y: 82, size: 20, rot: 10, op: 0.06 },
    { type: "X", x: 50, y: 90, size: 26, rot: -15, op: 0.05 },
    { type: "O", x: 30, y: 20, size: 16, rot: 8, op: 0.04 },
    { type: "X", x: 62, y: 50, size: 14, rot: 12, op: 0.04 },
    // Dashed route lines
    { type: "line1", op: 0.04 },
    { type: "line2", op: 0.04 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {items.filter(i => i.type !== "line1" && i.type !== "line2").map((item, i) => (
        <div
          key={i}
          className="absolute font-barlow font-black text-white"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: item.size,
            transform: `rotate(${item.rot}deg)`,
            opacity: item.op,
          }}
        >
          {item.type}
        </div>
      ))}
      {/* Diagonal dashed route lines */}
      <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.04 }}>
        <line x1="0" y1="30%" x2="40%" y2="60%" stroke="white" strokeWidth="1" strokeDasharray="6 8" />
        <line x1="100%" y1="20%" x2="60%" y2="55%" stroke="white" strokeWidth="1" strokeDasharray="6 8" />
        <line x1="20%" y1="100%" x2="50%" y2="40%" stroke="white" strokeWidth="1" strokeDasharray="6 8" />
        <circle cx="30%" cy="72%" r="18" stroke="white" strokeWidth="1.5" fill="none" />
        <circle cx="75%" cy="18%" r="12" stroke="white" strokeWidth="1.5" fill="none" />
        {/* X marks */}
        <line x1="80%" y1="72%" x2="88%" y2="80%" stroke="white" strokeWidth="1.5" />
        <line x1="88%" y1="72%" x2="80%" y2="80%" stroke="white" strokeWidth="1.5" />
        <line x1="12%" y1="42%" x2="18%" y2="48%" stroke="white" strokeWidth="1.5" />
        <line x1="18%" y1="42%" x2="12%" y2="48%" stroke="white" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

// Page-turn cover
function PlaybookCover({ onDone }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#0a1520", transformOrigin: "left center", perspective: "1200px" }}
    >
      <PlaybookBackground />

      {/* Binding spine */}
      <div
        className="absolute left-0 top-0 bottom-0 w-8 z-10 flex flex-col items-center justify-center gap-1"
        style={{ background: "linear-gradient(to right, #060e18, #0d1f30)" }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-3 h-0.5 rounded-full bg-white/10" />
        ))}
        <span
          className="absolute text-white/20 font-barlow font-black tracking-widest text-xs whitespace-nowrap"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}
        >
          OFFSZN
        </span>
      </div>

      {/* Cover content */}
      <div className="flex flex-col items-center gap-6 px-10 relative z-10">
        {/* Play diagram card */}
        <div
          className="w-52 h-32 rounded-xl overflow-hidden border border-white/10"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <PlayDiagram />
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="text-white/40 font-barlow text-xs uppercase tracking-[0.3em] mb-1">High Performance System</p>
          <h1 className="font-display text-white text-5xl tracking-widest leading-none">OFF</h1>
          <h1 className="font-display text-primary text-5xl tracking-widest leading-none">SZN</h1>
        </div>

        {/* Tap to open */}
        <motion.button
          onClick={onDone}
          className="mt-2 px-8 py-3 border border-primary/60 rounded-xl font-barlow font-bold uppercase tracking-widest text-primary text-sm"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Enter OFFSZN
        </motion.button>
      </div>

      {/* Page edge marks */}
      <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-around items-end px-1 py-8">
        {["FIELD", "STATS", "PLAYS", "TEAMS", "PLAYER"].map((tab, i) => (
          <div key={i} className="flex items-center gap-1">
            <span className="text-[8px] text-white/20 font-barlow uppercase tracking-widest">{tab}</span>
            <div className="w-1 h-4 rounded-l" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function PlaybookSplash({ onDone }) {
  const [phase, setPhase] = useState("cover"); // cover | flip | done

  const handleOpen = () => {
    setPhase("flip");
    setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, 900);
  };

  if (phase === "done") return null;

  return (
    <AnimatePresence>
      {phase === "cover" && (
        <motion.div
          key="cover"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <PlaybookCover onDone={handleOpen} />
        </motion.div>
      )}

      {phase === "flip" && (
        <motion.div
          key="flip"
          className="fixed inset-0 z-[100] overflow-hidden"
          style={{ background: "#0a1520", transformOrigin: "right center" }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -90 }}
          transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        >
          <PlaybookBackground />
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="font-display text-4xl text-white/20 tracking-widest">OFFSZN</h1>
          </div>
          {/* Page curl shadow */}
          <div
            className="absolute inset-y-0 right-0 w-12"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.5))",
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}