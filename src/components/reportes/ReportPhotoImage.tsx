'use client';

import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveReportPhotoUrl } from '@/lib/report-photo-url';

type ReportPhotoImageProps = {
  url: string;
  className?: string;
  imgClassName?: string;
};

export function ReportPhotoImage({ url, className, imgClassName }: ReportPhotoImageProps) {
  const [failed, setFailed] = useState(false);
  const src = resolveReportPhotoUrl(url);

  if (failed) {
    return (
      <div
        className={cn(
          'flex aspect-square w-full flex-col items-center justify-center gap-1 bg-black/40 text-white/35',
          className,
        )}
      >
        <ImageOff className="h-5 w-5" />
        <span className="px-2 text-center text-[10px]">No disponible</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn('aspect-square w-full object-cover', imgClassName, className)}
      onError={() => setFailed(true)}
    />
  );
}
