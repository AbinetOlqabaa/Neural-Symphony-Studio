import JSZip from 'jszip';
import type { AssetCategory, MediaAsset } from '../../types/studio';

const SUPPORTED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp']);
const MAX_FILES_PER_BATCH = 80;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function extToMime(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `len_${buffer.byteLength}_${Date.now()}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read media file'));
    reader.readAsDataURL(blob);
  });
}

function measureAndThumbnail(dataUrl: string): Promise<{ width: number; height: number; thumbnailUrl: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 1024;
      const height = img.naturalHeight || 576;
      try {
        const maxSide = 420;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ width, height, thumbnailUrl: canvas.toDataURL('image/jpeg', 0.82) });
          return;
        }
      } catch {
        // Fallback to original dataUrl if canvas fails
      }
      resolve({ width, height, thumbnailUrl: dataUrl });
    };
    img.onerror = () => resolve({ width: 0, height: 0, thumbnailUrl: dataUrl });
    img.src = dataUrl;
  });
}

export interface IngestionReport {
  added: MediaAsset[];
  duplicates: string[];
  skipped: string[];
}

export async function ingestMediaFiles(
  files: FileList | File[],
  projectId: string,
  existingHashes: Set<string>,
  defaultCategory: AssetCategory = 'character'
): Promise<IngestionReport> {
  const added: MediaAsset[] = [];
  const duplicates: string[] = [];
  const skipped: string[] = [];
  const seenInBatch = new Set<string>(existingHashes);

  const fileList = Array.from(files);

  const processImageEntry = async (
    name: string,
    blob: Blob,
    mimeType: string,
    sourceArchive?: string
  ) => {
    if (added.length >= MAX_FILES_PER_BATCH) {
      skipped.push(`${name} (batch limit ${MAX_FILES_PER_BATCH} reached)`);
      return;
    }
    if (blob.size > MAX_IMAGE_BYTES) {
      skipped.push(`${name} (exceeds 20MB limit)`);
      return;
    }
    const buffer = await blob.arrayBuffer();
    const sha256 = await computeSha256(buffer);
    if (seenInBatch.has(sha256)) {
      duplicates.push(name);
      return;
    }
    seenInBatch.add(sha256);

    const dataUrl = await blobToDataUrl(new Blob([buffer], { type: mimeType }));
    const { width, height, thumbnailUrl } = await measureAndThumbnail(dataUrl);

    added.push({
      id: `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      projectId,
      fileName: name,
      mimeType,
      mediaType: 'image',
      category: defaultCategory,
      width,
      height,
      fileSizeBytes: blob.size,
      sha256,
      dataUrl,
      thumbnailUrl,
      uploadedAt: new Date().toISOString(),
      sourceArchive,
      uploadStatus: 'ready',
      characterIds: [],
      sceneIds: [],
    });
  };

  for (const file of fileList) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (ext === 'zip' || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
      try {
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const entries = Object.values(zip.files).filter((e) => !e.dir && !e.name.startsWith('__MACOSX/'));
        for (const entry of entries) {
          const cleanName = entry.name.split('/').pop() || entry.name;
          const entryExt = cleanName.split('.').pop()?.toLowerCase() || '';
          if (!SUPPORTED_EXT.has(entryExt)) continue;
          const entryBlob = await entry.async('blob');
          await processImageEntry(cleanName, entryBlob, extToMime(entryExt), file.name);
        }
      } catch {
        skipped.push(`${file.name} (invalid ZIP archive)`);
      }
      continue;
    }

    if (SUPPORTED_EXT.has(ext)) {
      await processImageEntry(file.name, file, file.type || extToMime(ext));
    } else {
      skipped.push(`${file.name} (unsupported file type)`);
    }
  }

  return { added, duplicates, skipped };
}

export async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const [header, body] = url.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    return { base64: body || '', mimeType: mimeMatch?.[1] || 'image/jpeg' };
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  const [, body] = dataUrl.split(',');
  return { base64: body || '', mimeType: blob.type || 'image/jpeg' };
}
