// Shared framer-motion variants — native iOS feel across the app.
import { motion } from "framer-motion";

// Page-level staggered container — children slide in sequence.
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

// Stagger child — subtle slide + fade, no bounce.
export const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0, 0, 1] } },
};

// Haptic tap — mimics the "sink-in" of a physical button.
export const hapticTap = {
  whileTap: { scale: 0.96 },
  transition: { duration: 0.12, ease: [0.2, 0, 0, 1] },
};

// Motion-wrapped list wrapper for staggered grids/lists.
export const StaggerList = ({ children, className = "", style }) => (
  <motion.div
    className={className}
    style={style}
    variants={staggerContainer}
    initial="hidden"
    animate="visible"
  >
    {children}
  </motion.div>
);

export { motion };