"use client";

import { motion, useReducedMotion, animate, type Variants } from "motion/react";
import { useEffect, useState } from "react";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Fade + small rise on enter (never from scale 0). ease-out, <300ms. */
export function Reveal({
  children,
  delay = 0,
  y = 10,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={
        reduce ? { opacity: 0 } : { opacity: 0, transform: `translateY(${y}px)` }
      }
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.24, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};
const staggerChild: Variants = {
  hidden: { opacity: 0, transform: "translateY(8px)" },
  show: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.24, ease: EASE_OUT },
  },
};

/** Stagger a group's entrance (30–80ms between items). */
export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}

/** Count up to `value` when scrolled into view. Mono, tabular. */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  className,
  duration = 0.9,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduce) return; // reduced motion: render the final value directly (see `shown`)
    const controls = animate(0, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: setDisplay,
      onComplete: () => setDisplay(value),
    });
    // Safety net: if rAF is throttled/stalled, still land on the real value.
    const t = setTimeout(() => setDisplay(value), duration * 1000 + 400);
    return () => {
      controls.stop();
      clearTimeout(t);
    };
  }, [value, reduce, duration]);

  const shown = reduce ? value : display;
  return <span className={`tnum ${className ?? ""}`}>{format(shown)}</span>;
}
