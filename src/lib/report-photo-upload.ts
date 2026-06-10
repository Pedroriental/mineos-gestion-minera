import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  REPORT_PHOTO_MAX_BYTES,
  REPORT_PHOTO_MIME_TYPES,
} from '@/lib/report-photo-constants';
import { createServerClient } from '@/lib/supabase-server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { REPORT_PHOTOS_BUCKET } from '@/lib/report-photo-url';

export { REPORT_PHOTO_MAX_BYTES, REPORT_PHOTO_MAX_COUNT, REPORT_PHOTO_MIME_TYPES } from '@/lib/report-photo-constants';

function validatePhotoFile(file: File) {
  if (!file || file.size <= 0) return;
  if (file.size > REPORT_PHOTO_MAX_BYTES) {
    throw new Error(`Cada foto debe pesar menos de 5 MB (${file.name}).`);
  }
  if (!REPORT_PHOTO_MIME_TYPES.includes(file.type as (typeof REPORT_PHOTO_MIME_TYPES)[number])) {
    throw new Error(`Formato no permitido en "${file.name}". Use JPG, PNG o WebP.`);
  }
}

function photoFileName(file: File, prefix: string) {
  const clean = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(clean) || '.jpg';
  return `${prefix}_${randomUUID()}${ext}`;
}

async function saveReportPhotosLocal(
  files: File[],
  folder: string,
  prefix: string,
): Promise<string[]> {
  const urls: string[] = [];

  for (const file of files) {
    if (!file || file.size <= 0) continue;
    validatePhotoFile(file);

    const fileName = photoFileName(file, prefix);
    const relPath = path.join('uploads', folder, fileName);
    const absPath = path.join(process.cwd(), 'public', relPath);
    await mkdir(path.dirname(absPath), { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));
    urls.push(`/${relPath.replace(/\\/g, '/')}`);
  }

  return urls;
}

async function saveReportPhotosSupabase(
  files: File[],
  folder: string,
  prefix: string,
): Promise<string[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return saveReportPhotosLocal(files, folder, prefix);
  }

  const storage = getSupabaseAdmin() ?? (await createServerClient());
  const urls: string[] = [];

  for (const file of files) {
    if (!file || file.size <= 0) continue;
    validatePhotoFile(file);

    const fileName = photoFileName(file, prefix);
    const storagePath = `${folder}/${fileName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error } = await storage.storage.from(REPORT_PHOTOS_BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });

    if (error) {
      throw new Error(`No se pudo subir la foto: ${error.message}`);
    }

    const { data } = storage.storage.from(REPORT_PHOTOS_BUCKET).getPublicUrl(storagePath);
    urls.push(data.publicUrl);
  }

  return urls;
}

export async function saveReportPhotos(
  files: File[],
  folder: string,
  prefix: string,
): Promise<string[]> {
  return saveReportPhotosSupabase(files, folder, prefix);
}

export function parsePhotoKeepList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is string =>
        typeof item === 'string' &&
        item.trim().length > 0 &&
        (item.startsWith('/') || item.startsWith('http://') || item.startsWith('https://')),
    );
  } catch {
    return [];
  }
}

export function parsePhotoFiles(formData: FormData, field = 'fotos_nuevas'): File[] {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}
