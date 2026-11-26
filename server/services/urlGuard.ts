export function validateExternalServiceUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return { valid: false, error: 'Server URL is required.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format. Expected http:// or https://.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are permitted.' };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'Do not embed credentials in server URLs. Configure authentication tokens via server environment variables.',
    };
  }

  const host = parsed.hostname.toLowerCase();
  const blockedHosts = new Set([
    '169.254.169.254',
    'metadata.google.internal',
    'metadata.goog',
    '100.100.100.200',
    '0.0.0.0',
  ]);
  if (blockedHosts.has(host) || host.startsWith('169.254.') || host === '::' || host === '[::]') {
    return { valid: false, error: 'Access to cloud metadata or wildcard addresses is blocked.' };
  }

  const normalizedUrl = parsed.toString().replace(/\/+$/, '');
  return { valid: true, normalizedUrl };
}

export function sanitizeComfyPathSegment(raw: string, allowEmpty = false): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    if (allowEmpty) return '';
    throw new Error('Filename is required.');
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    throw new Error('Invalid path segment characters.');
  }
  return trimmed;
}

export function sanitizeUploadFileName(rawName: string): string {
  const base = (rawName || 'reference.png').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const trimmed = base.replace(/^_+|_+$/g, '') || 'reference.png';
  return trimmed.slice(0, 120);
}
