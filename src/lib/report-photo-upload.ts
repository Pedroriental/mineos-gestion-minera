import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  REPORT_PHOTO_MAX_BYTES,
  REPORT_PHOTO_MIME_TYPES,
} from '@/lib/report-photo-constants';

export { REPORT_PHOTO_MAX_BYTES, REPORT_PHOTO_MAX_COUNT, REPORT_PHOTO_MIME_TYPES } from '@/lib/report-photo-constants';

export async function saveReportPhotos(
  files: File[],
  folder: string,
  prefix: string,
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    if (!file || file.size <= 0) continue;
    if (file.size > REPORT_PHOTO_MAX_BYTES) {
      throw new Error(`Cada foto debe pesar menos de 5 MB (${file.name}).`);
    }
    if (!REPORT_PHOTO_MIME_TYPES.includes(file.type as (typeof REPORT_PHOTO_MIME_TYPES)[number])) {
      throw new Error(`Formato no permitido en "${file.name}". Use JPG, PNG o WebP.`);
    }

    const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(clean) || '.jpg';
    const fileName = `${prefix}_${randomUUID()}${ext}`;
    const relPath = path.join('uploads', folder, fileName);
    const absPath = path.join(process.cwd(), 'public', relPath);
    await mkdir(path.dirname(absPath), { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));
    urls.push(`/${relPath.replace(/\\/g, '/')}`);
  }

  return urls;
}

export function parsePhotoKeepList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.startsWith('/'));
  } catch {
    return [];
  }
}

export function parsePhotoFiles(formData: FormData, field = 'fotos_nuevas'): File[] {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}
