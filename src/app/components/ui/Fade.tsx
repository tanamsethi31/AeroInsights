/**
 * Fade
 * Opacity-only enter/exit wrapper — the only animation that is safe for
 * frequently toggled content sections.  No height, no scale, no layout.
 * Duration intentionally short (150ms) so it feels responsive, not theatrical.
 */
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

interface FadeProps {
  show: boolean;
  children: ReactNode;
  /** Pass a stable string key if you need AnimatePresence to track identity */
  id?: string;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export function Fade({ show, children, id }: FadeProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
