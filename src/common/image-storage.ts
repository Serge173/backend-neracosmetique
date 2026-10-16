import { BadRequestException, Logger } from '@nestjs/common';
import { del, put } from '@vercel/blob';
import * as fs from 'fs';
import { basename, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedImageFile {
  buffer: Buffer;
  originalname?: string;
}

export type ImageFolder = 'products' | 'avatars';

const logger = new Logger('ImageStorage');

/** Identifie le format réel à partir des premiers octets (l'extension et le type MIME envoyés ne sont pas fiables). */
export function detectImageType(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: '.png', mime: 'image/png' };
  }
  const head6 = buf.subarray(0, 6).toString('ascii');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return { ext: '.gif', mime: 'image/gif' };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * Enregistre une image (Vercel Blob en ligne, dossier `uploads/` en local) et renvoie son URL publique.
 * `localBaseUrl` sert uniquement en local, pour construire l'URL du fichier.
 */
export async function storeImage(file: UploadedImageFile | undefined, folder: ImageFolder, localBaseUrl: string, maxLabel: string): Promise<string> {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Aucun fichier envoyé');
  }
  const detected = detectImageType(file.buffer);
  if (!detected) {
    throw new BadRequestException(`Format image accepté : JPG, PNG, GIF, WebP (${maxLabel} max)`);
  }
  const filename = `${uuidv4()}${detected.ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${folder}/${filename}`, file.buffer, {
      access: 'public',
      contentType: detected.mime,
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    return blob.url;
  }
  if (process.env.VERCEL) {
    throw new BadRequestException('Stockage des images non configuré (BLOB_READ_WRITE_TOKEN manquant)');
  }

  const dir = join(process.cwd(), 'uploads', folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(join(dir, filename), file.buffer);
  return `${localBaseUrl}/uploads/${folder}/${filename}`;
}

/** Supprime une image enregistrée par `storeImage`. Ignore toute URL qui ne vient pas de notre stockage. */
export async function deleteStoredImage(url: string | null | undefined, folder: ImageFolder): Promise<void> {
  if (!url) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }
  try {
    if (parsed.hostname.endsWith('.public.blob.vercel-storage.com') && parsed.pathname.startsWith(`/${folder}/`)) {
      if (process.env.BLOB_READ_WRITE_TOKEN) await del(url);
      return;
    }
    if (!process.env.VERCEL && parsed.pathname.startsWith(`/uploads/${folder}/`)) {
      const file = join(process.cwd(), 'uploads', folder, basename(parsed.pathname));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  } catch (err) {
    logger.warn(`Suppression de l'image impossible : ${err instanceof Error ? err.message : String(err)}`);
  }
}
