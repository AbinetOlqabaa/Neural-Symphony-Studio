import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ExportSettings, LyricLine, RenderJobStatus } from '../../src/types/studio';

const execFileAsync = promisify(execFile);

const RENDER_ROOT = path.resolve(os.tmpdir(), 'neural-symphony-renders');
const DEMO_IMAGES_ROOT = path.resolve(process.cwd(), 'src', 'assets', 'images');

export interface RenderSegmentInput {
  title: string;
  durationSec: number;
  videoDataUrl?: string;
  imageDataUrl?: string;
}

export interface CreateRenderJobInput {
  projectId: string;
  projectName: string;
  segments: RenderSegmentInput[];
  exportSettings: ExportSettings;
  audioDataUrl?: string;
  audioFileName?: string;
  lyrics?: LyricLine[];
}

interface InternalRenderJob {
  status: RenderJobStatus;
  jobDir: string;
  outputPath: string;
}

const renderJobs = new Map<string, InternalRenderJob>();

function isPathInside(targetPath: string, baseDir: string): boolean {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(baseDir);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
}

function formatSrtTimestamp(sec: number): string {
  const safe = Math.max(0, sec);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )},${String(ms).padStart(3, '0')}`;
}

export function buildSrtContent(lyrics: LyricLine[]): string {
  return lyrics
    .filter((line) => line.text.trim().length > 0 && line.endTimeSec > line.startTimeSec)
    .map((line, index) => {
      const cleanText = line.text.replace(/\r?\n/g, ' ').trim();
      return `${index + 1}\n${formatSrtTimestamp(line.startTimeSec)} --> ${formatSrtTimestamp(
        line.endTimeSec
      )}\n${cleanText}`;
    })
    .join('\n\n');
}

async function materializeMediaInput(
  source: string,
  destPathWithoutExt: string,
  defaultExt: string
): Promise<string> {
  if (source.startsWith('data:')) {
    const match = source.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Malformed base64 data URI in render input.');
    }
    const mime = match[1].toLowerCase();
    const ext = mime.includes('png')
      ? '.png'
      : mime.includes('webp')
      ? '.webp'
      : mime.includes('mp4')
      ? '.mp4'
      : mime.includes('webm')
      ? '.webm'
      : mime.includes('mpeg') || mime.includes('mp3')
      ? '.mp3'
      : mime.includes('wav')
      ? '.wav'
      : defaultExt;
    const outPath = `${destPathWithoutExt}${ext}`;
    await fs.writeFile(outPath, Buffer.from(match[2], 'base64'));
    return outPath;
  }

  if (source.startsWith('/src/assets/images/')) {
    const fileName = path.basename(source);
    const resolvedDemo = path.resolve(DEMO_IMAGES_ROOT, fileName);
    if (!isPathInside(resolvedDemo, DEMO_IMAGES_ROOT)) {
      throw new Error('Invalid local asset reference path.');
    }
    const bytes = await fs.readFile(resolvedDemo);
    const ext = path.extname(fileName) || defaultExt;
    const outPath = `${destPathWithoutExt}${ext}`;
    await fs.writeFile(outPath, bytes);
    return outPath;
  }

  throw new Error('Unsupported media input URI for server FFmpeg render.');
}

async function executeRenderPipeline(job: InternalRenderJob, input: CreateRenderJobInput): Promise<void> {
  const warnings: string[] = [];
  const width = Math.max(320, Math.min(3840, Math.round(input.exportSettings.width / 2) * 2));
  const height = Math.max(240, Math.min(2160, Math.round(input.exportSettings.height / 2) * 2));
  const fps = Math.max(12, Math.min(60, Math.round(input.exportSettings.fps || 24)));
  const bitrate = `${Math.max(2, Math.min(40, Math.round(input.exportSettings.videoBitrateMbps || 10)))}M`;

  try {
    await fs.mkdir(job.jobDir, { recursive: true });
    job.status = { ...job.status, status: 'running', progress: 10, stage: 'Preparing segment inputs' };

    const segmentFiles: string[] = [];
    const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`;

    for (let i = 0; i < input.segments.length; i += 1) {
      const seg = input.segments[i];
      const dur = Math.max(0.5, Math.min(60, Number(seg.durationSec) || 2));
      const outSegPath = path.join(job.jobDir, `segment_${i}.mp4`);
      if (!isPathInside(outSegPath, job.jobDir)) {
        throw new Error('Segment path escaped render sandbox.');
      }

      if (seg.videoDataUrl) {
        const rawVid = await materializeMediaInput(
          seg.videoDataUrl,
          path.join(job.jobDir, `raw_vid_${i}`),
          '.mp4'
        );
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-i',
            rawVid,
            '-t',
            String(dur),
            '-r',
            String(fps),
            '-vf',
            scaleFilter,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-an',
            outSegPath,
          ],
          { shell: false, timeout: 60000 }
        );
      } else if (seg.imageDataUrl) {
        const rawImg = await materializeMediaInput(
          seg.imageDataUrl,
          path.join(job.jobDir, `raw_img_${i}`),
          '.jpg'
        );
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-loop',
            '1',
            '-t',
            String(dur),
            '-i',
            rawImg,
            '-r',
            String(fps),
            '-vf',
            scaleFilter,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-pix_fmt',
            'yuv420p',
            outSegPath,
          ],
          { shell: false, timeout: 60000 }
        );
      } else {
        await execFileAsync(
          'ffmpeg',
          [
            '-y',
            '-f',
            'lavfi',
            '-i',
            `color=c=0x10131a:s=${width}x${height}:r=${fps}:d=${dur}`,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-pix_fmt',
            'yuv420p',
            outSegPath,
          ],
          { shell: false, timeout: 30000 }
        );
      }

      segmentFiles.push(outSegPath);
      const pct = 15 + Math.round(((i + 1) / Math.max(1, input.segments.length)) * 55);
      job.status = {
        ...job.status,
        progress: pct,
        stage: `Encoded segment ${i + 1} / ${input.segments.length}`,
      };
    }

    const concatListPath = path.join(job.jobDir, 'concat_list.txt');
    const concatBody = segmentFiles.map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`).join('\n');
    await fs.writeFile(concatListPath, concatBody, 'utf8');

    const assembledVideoPath = path.join(job.jobDir, 'assembled_video.mp4');
    job.status = { ...job.status, progress: 75, stage: 'Concatenating timeline segments' };

    await execFileAsync(
      'ffmpeg',
      ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', assembledVideoPath],
      { shell: false, timeout: 60000 }
    );

    let currentVideo = assembledVideoPath;

    // Burn Unicode subtitles if requested and lyrics exist
    if (input.exportSettings.burnSubtitles && input.lyrics && input.lyrics.length > 0) {
      const srtBody = buildSrtContent(input.lyrics);
      if (srtBody.trim()) {
        const srtPath = path.join(job.jobDir, 'subtitles.srt');
        await fs.writeFile(srtPath, srtBody, 'utf8');
        const subtitledPath = path.join(job.jobDir, 'subtitled_video.mp4');
        job.status = { ...job.status, progress: 84, stage: 'Burning Unicode lyric subtitles' };
        try {
          await execFileAsync(
            'ffmpeg',
            [
              '-y',
              '-i',
              currentVideo,
              '-vf',
              `subtitles=filename='${srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`,
              '-c:v',
              'libx264',
              '-preset',
              'veryfast',
              '-b:v',
              bitrate,
              subtitledPath,
            ],
            { shell: false, timeout: 60000 }
          );
          currentVideo = subtitledPath;
        } catch {
          warnings.push('Subtitle burn-in skipped (system font or libass fallback).');
        }
      }
    }

    // Mux master audio track if requested and provided
    if (input.exportSettings.includeAudio && input.audioDataUrl) {
      job.status = { ...job.status, progress: 92, stage: 'Muxing master audio track' };
      const audioPath = await materializeMediaInput(
        input.audioDataUrl,
        path.join(job.jobDir, 'master_audio'),
        '.mp3'
      );
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          currentVideo,
          '-i',
          audioPath,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-shortest',
          '-movflags',
          '+faststart',
          job.outputPath,
        ],
        { shell: false, timeout: 60000 }
      );
    } else {
      await execFileAsync(
        'ffmpeg',
        ['-y', '-i', currentVideo, '-c', 'copy', '-movflags', '+faststart', job.outputPath],
        { shell: false, timeout: 45000 }
      );
    }

    const stat = await fs.stat(job.outputPath);
    job.status = {
      ...job.status,
      status: 'completed',
      progress: 100,
      stage: 'Render completed',
      completedAt: new Date().toISOString(),
      outputFileName: path.basename(job.outputPath),
      outputSizeBytes: stat.size,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (err) {
    job.status = {
      ...job.status,
      status: 'failed',
      progress: 0,
      stage: 'Render failed',
      completedAt: new Date().toISOString(),
      errorMessage: err instanceof Error ? err.message : 'FFmpeg render failed.',
    };
  }
}

export async function createRenderJob(input: CreateRenderJobInput): Promise<RenderJobStatus> {
  if (!Array.isArray(input.segments) || input.segments.length === 0) {
    throw new Error('At least one timeline block or scene segment is required to render MP4.');
  }

  const jobId = `rnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const safeBaseName =
    input.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'neural_symphony';

  const jobDir = path.resolve(RENDER_ROOT, jobId);
  const outputPath = path.resolve(jobDir, `${safeBaseName}.mp4`);
  if (!isPathInside(jobDir, RENDER_ROOT) || !isPathInside(outputPath, jobDir)) {
    throw new Error('Invalid render workspace path.');
  }

  const initialStatus: RenderJobStatus = {
    id: jobId,
    projectId: input.projectId,
    status: 'queued',
    progress: 0,
    stage: 'Queued for local FFmpeg assembly',
    createdAt: new Date().toISOString(),
  };

  const record: InternalRenderJob = {
    status: initialStatus,
    jobDir,
    outputPath,
  };
  renderJobs.set(jobId, record);

  void executeRenderPipeline(record, input);
  return initialStatus;
}

export function getRenderJobStatus(jobId: string): RenderJobStatus | null {
  return renderJobs.get(jobId)?.status || null;
}

export function getRenderOutputFile(jobId: string): { filePath: string; fileName: string } | null {
  const record = renderJobs.get(jobId);
  if (!record || record.status.status !== 'completed') return null;
  if (!isPathInside(record.outputPath, record.jobDir)) return null;
  return {
    filePath: record.outputPath,
    fileName: path.basename(record.outputPath),
  };
}
