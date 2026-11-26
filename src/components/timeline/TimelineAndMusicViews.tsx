import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Clock, Download, Pause, Play, Plus, Trash2, Upload } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import {
  SUPPORTED_LYRIC_LANGUAGES,
  exportLyricsToLrc,
  exportLyricsToSrt,
  findActiveLyric,
  formatTimestamp,
  parseLyricsInput,
} from '../../modules/music/lyricsParser';
import type { AudioAsset, TransitionType } from '../../types/studio';
import { MediaThumb } from '../shared/MediaThumb';

export function VideoTimelineView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const blocks = project?.timeline.blocks || [];
  const totalDuration = Math.max(
    1,
    blocks.reduce((max, b) => Math.max(max, b.startTimeSec + b.durationSec), 0)
  );

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (audioRef.current && project?.musicAsset) {
        setCurrentTime(audioRef.current.currentTime);
      } else {
        setCurrentTime((t) => {
          const next = t + 0.1;
          if (next >= totalDuration) {
            setPlaying(false);
            return 0;
          }
          return Number(next.toFixed(2));
        });
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [playing, totalDuration, project?.musicAsset]);

  if (!project) return null;

  const activeBlock =
    blocks.find((b) => currentTime >= b.startTimeSec && currentTime < b.startTimeSec + b.durationSec) || blocks[0];
  const activeScene = activeBlock ? project.scenes.find((s) => s.id === activeBlock.sceneId) : undefined;
  const activeClip = activeBlock?.clipId ? project.clips.find((c) => c.id === activeBlock.clipId) : undefined;
  const activeAsset = activeScene?.referenceAssetIds[0]
    ? project.mediaAssets.find((a) => a.id === activeScene.referenceAssetIds[0])
    : undefined;
  const activeLyric = project.timeline.showLyricsOverlay ? findActiveLyric(project.lyrics, currentTime) : undefined;

  const togglePlayback = () => {
    if (audioRef.current && project.musicAsset) {
      if (playing) audioRef.current.pause();
      else void audioRef.current.play();
    }
    setPlaying((p) => !p);
  };

  const recomputeSequentialBlocks = (nextBlocks: typeof blocks) => {
    let cursor = 0;
    return nextBlocks.map((b) => {
      const updated = { ...b, startTimeSec: Number(cursor.toFixed(2)) };
      cursor += b.durationSec;
      return updated;
    });
  };

  const shiftBlock = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const copy = blocks.slice();
    const tmp = copy[index];
    copy[index] = copy[target];
    copy[target] = tmp;
    store.updateActiveProject((proj) => ({
      ...proj,
      timeline: { ...proj.timeline, blocks: recomputeSequentialBlocks(copy) },
    }));
  };

  const pxPerSec = 36 * project.timeline.zoomLevel;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Video Timeline Editor</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Arrange generated clips, adjust clip durations and transitions, and preview synchronized audio with Unicode lyrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={project.timeline.showLyricsOverlay}
              onChange={(e) =>
                store.updateActiveProject((proj) => ({
                  ...proj,
                  timeline: { ...proj.timeline, showLyricsOverlay: e.target.checked },
                }))
              }
            />
            <span>Lyrics Overlay</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-[var(--ns-text-muted)]">Zoom</span>
            <input
              type="range"
              min={0.6}
              max={2.4}
              step={0.2}
              value={project.timeline.zoomLevel}
              onChange={(e) =>
                store.updateActiveProject((proj) => ({
                  ...proj,
                  timeline: { ...proj.timeline, zoomLevel: Number(e.target.value) },
                }))
              }
            />
          </label>
        </div>
      </div>

      {/* Preview Monitor */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3">
        <div className="relative aspect-video max-h-[360px] mx-auto bg-black rounded overflow-hidden border border-[var(--ns-border)]">
          <MediaThumb
            src={activeClip?.thumbnailUrl || activeAsset?.dataUrl}
            alt={activeBlock?.title || 'Timeline preview'}
            aspectClass="w-full h-full"
          />
          {activeLyric && (
            <div className="absolute inset-x-4 bottom-5 text-center pointer-events-none">
              <span className="inline-block px-3 py-1.5 rounded bg-black/80 text-white text-sm font-medium">
                {activeLyric.text}
              </span>
            </div>
          )}
        </div>

        {project.musicAsset && (
          <audio ref={audioRef} src={project.musicAsset.dataUrl} onEnded={() => setPlaying(false)} className="hidden" />
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlayback}
              className="h-8 px-3.5 rounded bg-[var(--ns-accent)] text-white font-medium inline-flex items-center gap-1.5"
            >
              {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{playing ? 'Pause' : 'Play Preview'}</span>
            </button>
            <span className="font-mono tabular-nums text-[var(--ns-text-muted)]">
              {formatTimestamp(currentTime)} / {formatTimestamp(totalDuration)}
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={totalDuration}
            step={0.1}
            value={currentTime}
            aria-label="Timeline playhead position"
            onChange={(e) => {
              const val = Number(e.target.value);
              setCurrentTime(val);
              if (audioRef.current) audioRef.current.currentTime = val;
            }}
            className="flex-1 min-w-[200px]"
          />
        </div>
      </div>

      {/* Multi-Track Timeline */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-4 overflow-x-auto">
        <div style={{ minWidth: `${Math.max(680, totalDuration * pxPerSec + 120)}px` }} className="space-y-3">
          {/* Video Track */}
          <div>
            <div className="text-[11px] font-medium text-[var(--ns-text-muted)] mb-1.5">Video Track (V1)</div>
            <div className="flex items-stretch gap-1.5 min-h-[68px] p-1.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
              {blocks.map((blk, index) => (
                <div
                  key={blk.id}
                  style={{ width: `${Math.max(120, blk.durationSec * pxPerSec)}px` }}
                  className="shrink-0 rounded border border-[var(--ns-border-strong)] bg-[var(--ns-surface-elevated)] p-2 flex flex-col justify-between text-xs"
                >
                  <div className="font-medium truncate">{blk.title}</div>
                  <div className="flex items-center justify-between gap-1 text-[11px] text-[var(--ns-text-subtle)]">
                    <span className="font-mono tabular-nums">{blk.durationSec}s</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${blk.title} left`}
                        onClick={() => shiftBlock(index, -1)}
                        className="p-0.5 hover:text-[var(--ns-text)]"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${blk.title} right`}
                        onClick={() => shiftBlock(index, 1)}
                        className="p-0.5 hover:text-[var(--ns-text)]"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audio Track */}
          <div>
            <div className="text-[11px] font-medium text-[var(--ns-text-muted)] mb-1.5">Audio Track (A1)</div>
            <div className="h-11 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] flex items-center justify-between text-xs">
              <span>{project.musicAsset ? project.musicAsset.fileName : 'No music track imported yet'}</span>
              <span className="font-mono tabular-nums text-[var(--ns-text-subtle)]">
                {project.musicAsset ? `${project.musicAsset.durationSeconds.toFixed(1)}s` : '—'}
              </span>
            </div>
          </div>

          {/* Lyrics Overlay Track */}
          <div>
            <div className="text-[11px] font-medium text-[var(--ns-text-muted)] mb-1.5">Lyrics Track (Subtitle Sync)</div>
            <div className="flex items-center gap-1.5 min-h-[42px] p-1.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
              {project.lyrics.map((lyr) => (
                <div
                  key={lyr.id}
                  style={{ width: `${Math.max(110, (lyr.endTimeSec - lyr.startTimeSec) * pxPerSec)}px` }}
                  className="shrink-0 px-2 py-1 rounded border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[11px] truncate"
                  title={lyr.text}
                >
                  {lyr.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Block Duration & Transition Table */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3">
        <h2 className="font-display text-sm font-semibold">Clip Timing & Transitions</h2>
        <div className="space-y-2">
          {blocks.map((blk) => (
            <div
              key={blk.id}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs"
            >
              <div className="sm:col-span-4 font-medium truncate">{blk.title}</div>
              <div className="sm:col-span-3 flex items-center gap-2">
                <span className="text-[var(--ns-text-muted)]">Duration (s)</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={blk.durationSec}
                  onChange={(e) => {
                    const dur = Math.max(0.5, Number(e.target.value) || 1);
                    const updated = blocks.map((b) => (b.id === blk.id ? { ...b, durationSec: dur } : b));
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      timeline: { ...proj.timeline, blocks: recomputeSequentialBlocks(updated) },
                    }));
                  }}
                  className="w-20 h-8 px-2 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)] font-mono tabular-nums"
                />
              </div>
              <div className="sm:col-span-4 flex items-center gap-2">
                <span className="text-[var(--ns-text-muted)]">Transition</span>
                <select
                  value={blk.transitionIn}
                  onChange={(e) => {
                    const trans = e.target.value as TransitionType;
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      timeline: {
                        ...proj.timeline,
                        blocks: proj.timeline.blocks.map((b) => (b.id === blk.id ? { ...b, transitionIn: trans } : b)),
                      },
                    }));
                  }}
                  className="h-8 px-2 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)]"
                >
                  <option value="cut">Hard Cut</option>
                  <option value="crossfade">Crossfade</option>
                  <option value="dip_to_black">Dip to Black</option>
                </select>
              </div>
              <div className="sm:col-span-1 text-right">
                <button
                  type="button"
                  aria-label={`Remove ${blk.title} from timeline`}
                  onClick={() => {
                    const remaining = blocks.filter((b) => b.id !== blk.id);
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      timeline: { ...proj.timeline, blocks: recomputeSequentialBlocks(remaining) },
                    }));
                  }}
                  className="p-1 text-[var(--ns-danger)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MusicLyricsView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const audioInputRef = useRef<HTMLInputElement>(null);
  const audioElRef = useRef<HTMLAudioElement>(null);
  const [bulkLyricsText, setBulkLyricsText] = useState('');
  const [currentTime, setCurrentTime] = useState(0);

  if (!project) return null;

  const handleAudioUpload = async (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const audio = new Audio(dataUrl);
      audio.onloadedmetadata = () => {
        const asset: AudioAsset = {
          id: `aud_${Date.now().toString(36)}`,
          fileName: file.name,
          mimeType: file.type || 'audio/mpeg',
          durationSeconds: Number((audio.duration || 0).toFixed(2)),
          fileSizeBytes: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        store.updateActiveProject((proj) => ({ ...proj, musicAsset: asset }));
        store.notify('success', `Imported audio "${file.name}"`);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleParseLyrics = () => {
    if (!bulkLyricsText.trim()) return;
    const parsed = parseLyricsInput(bulkLyricsText);
    store.setLyrics(parsed);
    setBulkLyricsText('');
    store.notify('success', `Imported ${parsed.length} lyric lines`);
  };

  const handleDownloadLrc = () => {
    const lrc = exportLyricsToLrc(project.lyrics);
    const blob = new Blob([lrc], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.lrc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const srt = exportLyricsToSrt(project.lyrics);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Music & Multilingual Lyrics</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Import MP3/WAV/M4A audio and synchronize English, Amharic (አማርኛ), Afaan Oromoo, and Tigrigna (ትግርኛ) lyrics to scenes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={audioInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleAudioUpload(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => audioInputRef.current?.click()}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Music Track</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadLrc}
            className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .LRC</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSrt}
            className="h-9 px-3.5 rounded-md border border-[var(--ns-border)] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .SRT</span>
          </button>
        </div>
      </div>

      {/* Audio Player */}
      <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            {project.musicAsset ? project.musicAsset.fileName : 'No audio track loaded (upload MP3, WAV, or M4A)'}
          </span>
          <span className="font-mono tabular-nums text-[var(--ns-text-muted)]">
            Playhead: {formatTimestamp(currentTime)}
          </span>
        </div>
        {project.musicAsset && (
          <audio
            ref={audioElRef}
            controls
            src={project.musicAsset.dataUrl}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            className="w-full"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Lyrics Bulk Import */}
        <div className="lg:col-span-5 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3">
          <h2 className="font-display text-sm font-semibold">Import / Paste Lyrics (Unicode & LRC)</h2>
          <textarea
            rows={7}
            value={bulkLyricsText}
            onChange={(e) => setBulkLyricsText(e.target.value)}
            placeholder={`[Verse 1]\n[00:04.00] ሌሊቱ ሲነጋ ብርሃን በከተማው\n[00:08.50] Halkan dukkana keessaa ifni ni dhufa`}
            className="w-full p-3 text-xs rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
          />
          <button
            type="button"
            onClick={handleParseLyrics}
            className="w-full h-9 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] text-xs font-medium"
          >
            Parse & Replace Lyrics List
          </button>
        </div>

        {/* Synchronized Lyrics Table */}
        <div className="lg:col-span-7 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold">Synchronized Lyric Lines ({project.lyrics.length})</h2>
            <button
              type="button"
              onClick={() =>
                store.setLyrics([
                  ...project.lyrics,
                  {
                    id: `lyr_${Date.now().toString(36)}`,
                    section: 'Verse',
                    text: 'New lyric line',
                    language: 'English',
                    startTimeSec: Number(currentTime.toFixed(2)),
                    endTimeSec: Number((currentTime + 4).toFixed(2)),
                  },
                ])
              }
              className="h-8 px-3 rounded border border-[var(--ns-border)] text-xs inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Line</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {project.lyrics.map((line) => (
              <div
                key={line.id}
                className="p-2.5 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-inset)] space-y-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={line.section}
                      aria-label="Lyric section"
                      onChange={(e) =>
                        store.setLyrics(
                          project.lyrics.map((l) => (l.id === line.id ? { ...l, section: e.target.value } : l))
                        )
                      }
                      className="w-24 h-7 px-2 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)]"
                    />
                    <select
                      aria-label="Lyric language"
                      value={line.language}
                      onChange={(e) =>
                        store.setLyrics(
                          project.lyrics.map((l) => (l.id === line.id ? { ...l, language: e.target.value } : l))
                        )
                      }
                      className="h-7 px-2 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)] text-[11px]"
                    >
                      {SUPPORTED_LYRIC_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono tabular-nums">
                    <button
                      type="button"
                      onClick={() =>
                        store.setLyrics(
                          project.lyrics.map((l) =>
                            l.id === line.id ? { ...l, startTimeSec: Number(currentTime.toFixed(2)) } : l
                          )
                        )
                      }
                      title="Stamp current audio playback time"
                      className="h-7 px-2 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface)] inline-flex items-center gap-1 text-[11px]"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Stamp {formatTimestamp(line.startTimeSec)}</span>
                    </button>
                    <select
                      aria-label="Associate lyric with scene"
                      value={line.sceneId || ''}
                      onChange={(e) =>
                        store.setLyrics(
                          project.lyrics.map((l) => (l.id === line.id ? { ...l, sceneId: e.target.value } : l))
                        )
                      }
                      className="h-7 px-2 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)] text-[11px]"
                    >
                      <option value="">No scene</option>
                      {project.scenes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <input
                  type="text"
                  value={line.text}
                  onChange={(e) =>
                    store.setLyrics(project.lyrics.map((l) => (l.id === line.id ? { ...l, text: e.target.value } : l)))
                  }
                  className="w-full h-8 px-2.5 rounded bg-[var(--ns-surface)] border border-[var(--ns-border)] text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
