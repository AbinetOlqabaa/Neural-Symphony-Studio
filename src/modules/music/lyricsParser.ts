import type { LyricLine } from '../../types/studio';

const LRC_TIMESTAMP_RE = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/;
const SECTION_HEADER_RE = /^\[([A-Za-z0-9\s\-_]+)\]$/;

export const SUPPORTED_LYRIC_LANGUAGES = [
  'English',
  'Amharic (አማርኛ)',
  'Afaan Oromoo',
  'Tigrigna (ትግርኛ)',
] as const;

export function normalizeUnicodeText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function formatTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.round((safe - Math.floor(safe)) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(
    centis === 100 ? 99 : centis
  ).padStart(2, '0')}`;
}

export function detectLyricLanguage(text: string): string {
  const normalized = text.normalize('NFC');
  if (/[\u1200-\u137F]/.test(normalized)) {
    // Tigrigna-distinct Ethiopic characters (ቐ-ቖ, ኸ-ኾ) or common Tigrigna markers
    if (
      /[\u1250-\u1256\u12B8-\u12BE]/.test(normalized) ||
      /(ንዓኻ|ኣብ|ከመይ|ፍቕሪ|ብዛዕባ|ጸሓይ|ኣለኹ|ትግርኛ)/.test(normalized)
    ) {
      return 'Tigrigna (ትግርኛ)';
    }
    return 'Amharic (አማርኛ)';
  }
  if (/\b(jaalala|halkan|si|koo|biyya|galata|qalbii|guyyaa)\b/i.test(normalized)) return 'Afaan Oromoo';
  return 'English';
}

export function parseLyricsInput(rawText: string, fallbackLanguage?: string): LyricLine[] {
  const lines = rawText.split(/\r?\n/);
  const parsed: LyricLine[] = [];
  let currentSection = 'Verse 1';
  let runningTime = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].normalize('NFC').trim();
    if (!trimmed) continue;

    const lrcMatch = trimmed.match(LRC_TIMESTAMP_RE);
    if (lrcMatch) {
      const mins = Number(lrcMatch[1]);
      const secs = Number(lrcMatch[2]);
      const fracStr = lrcMatch[3] || '0';
      const frac = Number(fracStr) / Math.pow(10, fracStr.length);
      const startTimeSec = Number((mins * 60 + secs + frac).toFixed(2));
      const text = normalizeUnicodeText(lrcMatch[4]);
      if (!text) continue;

      if (parsed.length > 0 && startTimeSec > parsed[parsed.length - 1].startTimeSec) {
        parsed[parsed.length - 1].endTimeSec = startTimeSec;
      }

      parsed.push({
        id: `lyr_${i}_${startTimeSec}`,
        section: currentSection,
        text,
        language: fallbackLanguage || detectLyricLanguage(text),
        startTimeSec,
        endTimeSec: startTimeSec + 4,
      });
      runningTime = startTimeSec + 4;
      continue;
    }

    const sectionMatch = trimmed.match(SECTION_HEADER_RE);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const cleanText = normalizeUnicodeText(trimmed);
    parsed.push({
      id: `lyr_${i}_${runningTime}`,
      section: currentSection,
      text: cleanText,
      language: fallbackLanguage || detectLyricLanguage(cleanText),
      startTimeSec: runningTime,
      endTimeSec: runningTime + 4,
    });
    runningTime += 4;
  }

  return parsed;
}

export function findActiveLyric(lines: LyricLine[], currentTimeSec: number): LyricLine | undefined {
  return lines.find((line) => currentTimeSec >= line.startTimeSec && currentTimeSec < line.endTimeSec);
}

export function exportLyricsToLrc(lines: LyricLine[]): string {
  return lines
    .slice()
    .sort((a, b) => a.startTimeSec - b.startTimeSec)
    .map((line) => `[${formatTimestamp(line.startTimeSec)}] ${line.text.normalize('NFC')}`)
    .join('\n');
}

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(
    ms === 1000 ? 999 : ms
  ).padStart(3, '0')}`;
}

export function exportLyricsToSrt(lines: LyricLine[]): string {
  return lines
    .slice()
    .sort((a, b) => a.startTimeSec - b.startTimeSec)
    .map((line, i) => `${i + 1}\n${formatSrtTime(line.startTimeSec)} --> ${formatSrtTime(line.endTimeSec)}\n${line.text.normalize('NFC')}\n`)
    .join('\n');
}
