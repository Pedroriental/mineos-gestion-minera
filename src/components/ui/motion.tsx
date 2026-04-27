'use client';

/**
 * Wrappers de animación con Framer Motion para MineOS.
 *
 * Patrón: Server Component pasa JSX como children →
 *         Client Component aplica animaciones.
 *
 * Nunca importar en Server Components directamente —
 * solo usarlos como wrappers que reciben children RSC.
 */

import { motion, type Variants } from 'framer-motion';

// ── Variantes compartidas ─────────────────────────────────────

const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show:   {
    opacity:    1,
    y:          0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainerVariants: Variants = {
  hidden: {},
  show:   {
    transition: {
      staggerChildren:  0.07,
      delayChildren:    0.05,
    },
  },
};

const staggerItemVariants: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show:   {
    opacity:    1,
    y:          0,
    scale:      1,
    transition: {
      type:      'spring',
      stiffness: 100,
      damping:   15,
    },
  },
};

// ─────────────────────────────────────────────────────────────
// FadeIn — envuelve cualquier contenido con fade + slide suave
// ─────────────────────────────────────────────────────────────
interface FadeInProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
  children: React.ReactNode;
}

export function FadeIn({ delay = 0, className, children, ...props }: FadeInProps) {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="show"
      transition={{ delay } as any}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// StaggerGrid — contenedor con stagger automático de hijos
// ─────────────────────────────────────────────────────────────
interface StaggerGridProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
  children: React.ReactNode;
}

export function StaggerGrid({ delay = 0, className, children, ...props }: StaggerGridProps) {
  return (
    <motion.div
      variants={{
        ...staggerContainerVariants,
        show: {
          ...staggerContainerVariants.show,
          transition: {
            ...(staggerContainerVariants.show as any).transition,
            delayChildren: delay,
          },
        },
      }}
      initial="hidden"
      animate="show"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// StaggerItem — hijo directo de StaggerGrid
// ─────────────────────────────────────────────────────────────
interface StaggerItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function StaggerItem({ className, children, ...props }: StaggerItemProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// FadeInSection — para secciones grandes (charts, tables)
// Fade more subtle, sin y displacement
// ─────────────────────────────────────────────────────────────
interface FadeInSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
  children: React.ReactNode;
}

export function FadeInSection({ delay = 0, className, children, ...props }: FadeInSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
