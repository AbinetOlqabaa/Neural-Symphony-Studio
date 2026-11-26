import { useState } from 'react';
import { Film } from 'lucide-react';

interface MediaThumbProps {
  src?: string;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export function MediaThumb({ src, alt, className = '', aspectClass = 'aspect-video' }: MediaThumbProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${aspectClass} ${className} flex flex-col items-center justify-center bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-[var(--ns-text-subtle)] px-3 text-center`}
      >
        <Film className="w-5 h-5 mb-1.5 opacity-70" />
        <span className="text-xs truncate max-w-full">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} ${className} overflow-hidden bg-[var(--ns-surface-inset)]`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
