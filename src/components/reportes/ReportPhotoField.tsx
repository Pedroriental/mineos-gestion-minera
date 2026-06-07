'use client';

import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { REPORT_PHOTO_MAX_COUNT } from '@/lib/report-photo-constants';

export type ReportPhotoDraft =
  | { id: string; kind: 'existing'; url: string }
  | { id: string; kind: 'new'; file: File; previewUrl: string };

export function reportPhotoDraftsFromUrls(urls: string[] | undefined | null): ReportPhotoDraft[] {
  return (urls ?? []).map((url) => ({ id: url, kind: 'existing' as const, url }));
}

export function revokeReportPhotoPreviews(drafts: ReportPhotoDraft[]) {
  drafts.forEach((draft) => {
    if (draft.kind === 'new') URL.revokeObjectURL(draft.previewUrl);
  });
}

type ReportPhotoFieldProps = {
  photos: ReportPhotoDraft[];
  onChange: (next: ReportPhotoDraft[]) => void;
  disabled?: boolean;
  max?: number;
  className?: string;
};

export function ReportPhotoField({
  photos,
  onChange,
  disabled,
  max = REPORT_PHOTO_MAX_COUNT,
  className,
}: ReportPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, max - photos.length);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length || disabled) return;
    const next = [...photos];
    for (const file of Array.from(fileList)) {
      if (next.length >= max) break;
      if (!file.type.startsWith('image/')) continue;
      next.push({
        id: `new-${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        kind: 'new',
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removePhoto = (id: string) => {
    const target = photos.find((photo) => photo.id === id);
    if (target?.kind === 'new') URL.revokeObjectURL(target.previewUrl);
    onChange(photos.filter((photo) => photo.id !== id));
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => {
          const src = photo.kind === 'existing' ? photo.url : photo.previewUrl;
          return (
            <div
              key={photo.id}
              className="group relative h-20 w-20 overflow-hidden rounded-xl border border-white/10 bg-black/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-md bg-black/70 p-1 text-white/80 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Quitar foto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}

        {remaining > 0 && !disabled ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 bg-white/[0.03] text-[10px] font-semibold text-white/45 transition-colors hover:border-amber-400/35 hover:text-amber-300/80"
            >
              <ImagePlus className="h-4 w-4" />
              Agregar
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </>
        ) : null}
      </div>
      <p className="text-[11px] text-white/35">
        {photos.length}/{max} fotos · JPG, PNG o WebP · máx. 5 MB c/u
      </p>
    </div>
  );
}
