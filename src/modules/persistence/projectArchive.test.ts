import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortableManifest, exportProjectToZipBlob, importProjectFromZipBuffer, validateProjectObject } from './projectArchive';
import type { Project } from '../../types/studio';

const sampleProject: Project = {
  id: 'proj_test_1',
  name: 'Test Music Video',
  description: 'Archive roundtrip test',
  createdAt: '2026-11-26T00:00:00Z',
  updatedAt: '2026-11-26T00:00:00Z',
  status: 'draft',
  settings: { defaultEngine: 'ltx-video', defaultWidth: 768, defaultHeight: 512, defaultFps: 24 },
  mediaAssets: [],
  analyses: {},
  characters: [],
  scenes: [],
  promptHistory: [],
  jobs: [],
  clips: [],
  lyrics: [{ id: 'l1', section: 'Chorus', text: 'ሰላም ለሁሉም', language: 'Amharic (አማርኛ)', startTimeSec: 0, endTimeSec: 4 }],
  timeline: { fps: 24, resolutionWidth: 1920, resolutionHeight: 1080, blocks: [], showLyricsOverlay: true, zoomLevel: 1 },
  workflows: [],
  exportSettings: { format: 'mp4', width: 1920, height: 1080, fps: 24, videoBitrateMbps: 12, includeAudio: true, burnSubtitles: true },
  extraMetadata: { customFutureField: 'preserved' },
};

test('projectArchive exports and re-imports valid ZIP archive preserving extraMetadata', async () => {
  const manifest = buildPortableManifest(sampleProject);
  assert.equal(manifest.projectId, 'proj_test_1');

  const blob = await exportProjectToZipBlob(sampleProject);
  const buffer = await blob.arrayBuffer();
  const imported = await importProjectFromZipBuffer(buffer);

  assert.equal(imported.valid, true);
  assert.equal(imported.project?.name, 'Test Music Video');
  assert.equal(imported.project?.extraMetadata?.customFutureField, 'preserved');
  assert.equal(imported.project?.lyrics[0].text, 'ሰላም ለሁሉም');

  const badCheck = validateProjectObject({ name: 'Incomplete' });
  assert.equal(badCheck.valid, false);
});
