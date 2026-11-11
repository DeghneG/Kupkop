'use client';

import { createClient } from '@/lib/supabase/client';
import { compressVideoFrame } from '@/lib/sos/utils';
import { isDemoOn } from '@/lib/demo/demo';

/** Shrinks a chosen photo to a small WebP/JPEG so a clinic on mobile data can upload it. */
async function shrink(file: File, maxWidth: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const { blob, previewUrl } = await compressVideoFrame(canvas, maxWidth, quality);
  URL.revokeObjectURL(previewUrl);
  return blob;
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Prepares a recovery photo and returns the value to pass as p_photo_path.
 * Real app: uploads into recovery-photos/<case id>/ and returns the path. Demo: returns a small data URL.
 */
export async function prepareRecoveryPhoto(reportId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  if (isDemoOn()) return toDataUrl(await shrink(file, 480, 0.6));
  const blob = await shrink(file, 1280, 0.75);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${reportId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from('recovery-photos').upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error('Could not upload the photo. Check your connection and try again.');
  return path;
}
