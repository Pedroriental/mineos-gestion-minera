'use client';

import { cn } from '@/lib/utils';
import { fontDisplay } from '@/lib/fonts';
import type { AppSectionMeta } from '@/lib/app-section-meta';

type MobileSectionLeadProps = {
  meta: AppSectionMeta;
  /** Sustituye el título del meta (p. ej. Command Center en inicio) */
  titleOverride?: string;
  className?: string;
  /** Una línea: solo título centrado, sin descripción */
  inline?: boolean;
  showDescription?: boolean;
};

export function MobileSectionLead({
  meta,
  titleOverride,
  className,
  inline = true,
  showDescription = false,
}: MobileSectionLeadProps) {
  const title = titleOverride ?? meta.title;

  return (
    <header
      className={cn(
        'mobile-section-lead',
        inline && 'mobile-section-lead--inline',
        className,
      )}
    >
      <h1
        className={cn(
          'mobile-section-lead__title font-display',
          fontDisplay.className,
          meta.titleClassName,
        )}
      >
        {title}
      </h1>
      {showDescription && meta.description ? (
        <p className="mobile-section-lead__desc mt-0.5 line-clamp-2 text-[10px] leading-snug">
          {meta.description}
        </p>
      ) : null}
    </header>
  );
}
