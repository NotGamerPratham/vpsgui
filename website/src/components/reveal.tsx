import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Seconds. Use small increments to stagger siblings. */
  delay?: number;
  y?: number;
}

/**
 * Scroll-triggered entrance. `once` keeps content from re-animating when the
 * reader scrolls back up, and the reduced-motion branch renders the final state
 * immediately rather than animating faster.
 */
export function Reveal({ children, className, delay = 0, y = 18 }: RevealProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}
