import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLyricLanguage,
  exportLyricsToLrc,
  exportLyricsToSrt,
  findActiveLyric,
  formatTimestamp,
  parseLyricsInput,
} from './lyricsParser';

test('parseLyricsInput parses LRC timestamps and Unicode Amharic, Tigrigna, and Afaan Oromoo lines', () => {
  const input = `[Verse 1]
[00:04.50] ሌሊቱ ሲነጋ ብርሃን ይመጣል
[00:09.00] Halkan dukkana keessaa ifni ni dhufa
[00:12.00] ንዓኻ ሰላም ኣብ ከተማ ኣኽሱም
[00:16.25] City lights reflect on rain`;

  const lines = parseLyricsInput(input);
  assert.equal(lines.length, 4);
  assert.equal(lines[0].language, 'Amharic (አማርኛ)');
  assert.equal(lines[1].language, 'Afaan Oromoo');
  assert.equal(lines[2].language, 'Tigrigna (ትግርኛ)');
  assert.equal(lines[3].language, 'English');
  assert.equal(lines[0].startTimeSec, 4.5);
  assert.equal(lines[0].endTimeSec, 9);

  const active = findActiveLyric(lines, 10.2);
  assert.equal(active?.text, 'Halkan dukkana keessaa ifni ni dhufa');
  assert.equal(formatTimestamp(65.5), '01:05.50');
  assert.match(exportLyricsToLrc(lines), /\[00:04\.50\] ሌሊቱ ሲነጋ ብርሃን ይመጣል/);
  assert.match(exportLyricsToSrt(lines), /00:00:12,000 --> 00:00:16,250\nንዓኻ ሰላም ኣብ ከተማ ኣኽሱም/);
  assert.equal(detectLyricLanguage('ሰላም'), 'Amharic (አማርኛ)');
  assert.equal(detectLyricLanguage('ፍቕሪ ሰላም ኣብዚ'), 'Tigrigna (ትግርኛ)');
});
