import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { createApiApp } from '../app';

async function startMockServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse, body: Buffer) => void
): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => handler(req, res, Buffer.concat(chunks)));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${addr.port}` };
}

test('Express API routes: SSRF blocking, ComfyUI mock E2E flow, Qwen mock, and real local FFmpeg MP4 render', async () => {
  // 1. Start Studio API app
  const apiApp = createApiApp();
  const apiServer = http.createServer(apiApp);
  await new Promise<void>((resolve) => apiServer.listen(0, '127.0.0.1', () => resolve()));
  const apiPort = (apiServer.address() as AddressInfo).port;
  const apiBase = `http://127.0.0.1:${apiPort}`;

  // 2. Start Mock ComfyUI Server
  let lastUploadedMultipartContainsFilename = false;
  const fakePngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const mockComfy = await startMockServer((req, res, body) => {
    const url = req.url || '';
    if (url.startsWith('/system_stats')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          system: { comfyui_version: '0.3.14-mock', os: 'linux', ram_total: 32e9, ram_free: 16e9 },
          devices: [{ name: 'Mock GPU', vram_total: 24e9, vram_free: 20e9 }],
        })
      );
      return;
    }
    if (url.startsWith('/object_info')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          CheckpointLoaderSimple: { input: { required: { ckpt_name: [['ltx-video-2b-v0.9.5.safetensors']] } } },
          UNETLoader: { input: { required: { unet_name: [['wan2.1_i2v_480p_14B_fp16.safetensors']] } } },
          LoraLoader: { input: { required: { lora_name: [[]] } } },
          LTXVImgToVideo: { input: { required: {} } },
          KSampler: { input: { required: {} } },
          VHS_VideoCombine: { input: { required: {} } },
        })
      );
      return;
    }
    if (url.startsWith('/upload/image') && req.method === 'POST') {
      lastUploadedMultipartContainsFilename = body.toString('utf8').includes('selam_ref.png');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ name: 'uploaded_selam_ref.png', subfolder: '', type: 'input' }));
      return;
    }
    if (url.startsWith('/prompt') && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ prompt_id: 'mock_prompt_99', number: 1 }));
      return;
    }
    if (url.startsWith('/history/mock_prompt_99')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          mock_prompt_99: {
            status: { completed: true, status_str: 'success' },
            outputs: {
              '7': { images: [{ filename: 'out_frame_001.png', subfolder: '', type: 'output' }] },
            },
          },
        })
      );
      return;
    }
    if (url.startsWith('/view')) {
      res.setHeader('Content-Type', 'image/png');
      res.end(fakePngBytes);
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  // 3. Start Mock Qwen2.5-VL Server
  const mockQwen = await startMockServer((req, res) => {
    const url = req.url || '';
    if (url.startsWith('/v1/models')) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ data: [{ id: 'Qwen/Qwen2.5-VL-3B-Instruct' }] }));
      return;
    }
    if (url.startsWith('/v1/chat/completions') && req.method === 'POST') {
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  description: 'Mocked Qwen portrait description',
                  identifiedSubjects: ['Vocalist'],
                  suggestedSceneCategories: ['Verse'],
                  suggestedCinematicTreatment: 'Slow push-in',
                  visualAttributes: {
                    mainSubjects: ['Vocalist'],
                    humanSubjects: 'Woman singing',
                    clothing: 'Charcoal coat',
                    hairstyle: 'Curly',
                    facialCharacteristics: 'Warm expression',
                    pose: 'Standing',
                    bodyOrientation: 'Front',
                    environment: 'Street',
                    background: 'Bokeh lights',
                    lighting: 'Warm amber',
                    cameraPerspective: 'Eye level',
                    composition: 'Centered',
                    objects: ['Mic'],
                    colors: ['Amber'],
                    visualStyle: '35mm',
                    emotionalExpression: 'Focused',
                    imageQuality: 'Sharp',
                  },
                }),
              },
            },
          ],
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end();
  });

  // 4. Start 401 Auth-Required Mock Server
  const mockAuthRequired = await startMockServer((_req, res) => {
    res.statusCode = 401;
    res.end('Unauthorized');
  });

  try {
    // SSRF & credential rejection checks
    const metadataProbe = await fetch(`${apiBase}/api/comfyui/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' }),
    }).then((r) => r.json() as Promise<{ status: string; connected: boolean }>);
    assert.equal(metadataProbe.connected, false);
    assert.equal(metadataProbe.status, 'configuration_invalid');

    const userinfoProbe = await fetch(`${apiBase}/api/comfyui/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://user:secret@127.0.0.1:8188' }),
    }).then((r) => r.json() as Promise<{ status: string; connected: boolean }>);
    assert.equal(userinfoProbe.connected, false);
    assert.equal(userinfoProbe.status, 'configuration_invalid');

    // Auth required classification check
    const authProbe = await fetch(`${apiBase}/api/comfyui/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mockAuthRequired.baseUrl }),
    }).then((r) => r.json() as Promise<{ status: string; connected: boolean }>);
    assert.equal(authProbe.connected, false);
    assert.equal(authProbe.status, 'authentication_required');

    // Connected ComfyUI E2E: probe -> object_info -> upload-image -> prompt -> history -> view
    const okProbe = await fetch(`${apiBase}/api/comfyui/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mockComfy.baseUrl }),
    }).then((r) => r.json() as Promise<{ connected: boolean; status: string; comfyVersion: string }>);
    assert.equal(okProbe.connected, true);
    assert.equal(okProbe.status, 'connected');
    assert.equal(okProbe.comfyVersion, '0.3.14-mock');

    const models = await fetch(`${apiBase}/api/comfyui/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mockComfy.baseUrl }),
    }).then((r) => r.json() as Promise<{ checkpoints: string[]; nodeTypes: string[] }>);
    assert.ok(models.checkpoints.includes('ltx-video-2b-v0.9.5.safetensors'));
    assert.ok(models.nodeTypes.includes('LTXVImgToVideo'));

    const uploadRes = await fetch(`${apiBase}/api/comfyui/upload-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mockComfy.baseUrl,
        fileName: 'selam_ref.png',
        mimeType: 'image/png',
        base64Data: fakePngBytes.toString('base64'),
      }),
    }).then((r) => r.json() as Promise<{ name: string }>);
    assert.equal(uploadRes.name, 'uploaded_selam_ref.png');
    assert.equal(lastUploadedMultipartContainsFilename, true);

    const promptRes = await fetch(`${apiBase}/api/comfyui/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: mockComfy.baseUrl,
        clientId: 'test_client',
        workflowPrompt: { '1': { class_type: 'KSampler', inputs: {} } },
      }),
    }).then((r) => r.json() as Promise<{ prompt_id: string }>);
    assert.equal(promptRes.prompt_id, 'mock_prompt_99');

    const histRes = await fetch(`${apiBase}/api/comfyui/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: mockComfy.baseUrl, promptId: 'mock_prompt_99' }),
    }).then((r) => r.json() as Promise<{ parsed: { completed: boolean; outputs: Array<{ filename: string }> } }>);
    assert.equal(histRes.parsed.completed, true);
    assert.equal(histRes.parsed.outputs[0].filename, 'out_frame_001.png');

    const viewRes = await fetch(
      `${apiBase}/api/comfyui/view?${new URLSearchParams({
        url: mockComfy.baseUrl,
        filename: 'out_frame_001.png',
        type: 'output',
      }).toString()}`
    );
    assert.equal(viewRes.status, 200);
    const viewBytes = Buffer.from(await viewRes.arrayBuffer());
    assert.deepEqual(viewBytes, fakePngBytes);

    // Qwen2.5-VL test & analyze
    const qwenTest = await fetch(`${apiBase}/api/vision/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpointUrl: mockQwen.baseUrl }),
    }).then((r) => r.json() as Promise<{ connected: boolean; models: string[] }>);
    assert.equal(qwenTest.connected, true);
    assert.ok(qwenTest.models.includes('Qwen/Qwen2.5-VL-3B-Instruct'));

    const qwenAnalyze = await fetch(`${apiBase}/api/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpointUrl: mockQwen.baseUrl,
        modelId: 'Qwen/Qwen2.5-VL-3B-Instruct',
        assetId: 'asset_1',
        base64Data: fakePngBytes.toString('base64'),
        mimeType: 'image/png',
      }),
    }).then((r) => r.json() as Promise<{ description: string; provider: string }>);
    assert.equal(qwenAnalyze.provider, 'qwen-vl');
    assert.equal(qwenAnalyze.description, 'Mocked Qwen portrait description');

    // Real FFmpeg Render Test (uses existing demo image + multilingual Unicode lyrics!)
    const demoImageBytes = await fs.readFile('src/assets/images/demo_vocalist_portrait_1795679325466.jpg');
    const demoDataUri = `data:image/jpeg;base64,${demoImageBytes.toString('base64')}`;

    const renderCreate = await fetch(`${apiBase}/api/render/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: 'proj_test',
        projectName: 'FFmpeg Verification',
        segments: [
          { title: 'Segment 1', durationSec: 1.0, imageDataUrl: demoDataUri },
        ],
        exportSettings: {
          format: 'mp4',
          width: 640,
          height: 360,
          fps: 24,
          videoBitrateMbps: 2,
          includeAudio: false,
          burnSubtitles: true,
        },
        lyrics: [
          {
            id: 'l1',
            section: 'Verse',
            text: 'ሌሊቱ ሲነጋ · Halkan dukkana',
            language: 'Amharic/Oromo',
            startTimeSec: 0,
            endTimeSec: 0.9,
          },
        ],
      }),
    });
    assert.equal(renderCreate.status, 202);
    const createdJob = (await renderCreate.json()) as { id: string };

    let finalRenderStatus: { status: string; outputSizeBytes?: number; errorMessage?: string } = { status: 'queued' };
    for (let i = 0; i < 30; i += 1) {
      await new Promise((r) => setTimeout(r, 400));
      finalRenderStatus = (await fetch(`${apiBase}/api/render/jobs/${createdJob.id}`).then((r) => r.json())) as {
        status: string;
        outputSizeBytes?: number;
        errorMessage?: string;
      };
      if (finalRenderStatus.status === 'completed' || finalRenderStatus.status === 'failed') break;
    }

    assert.equal(
      finalRenderStatus.status,
      'completed',
      `FFmpeg render failed: ${finalRenderStatus.errorMessage || 'unknown'}`
    );
    assert.ok((finalRenderStatus.outputSizeBytes || 0) > 1000);

    const mp4Res = await fetch(`${apiBase}/api/render/jobs/${createdJob.id}/output`);
    assert.equal(mp4Res.status, 200);
    const mp4Buf = Buffer.from(await mp4Res.arrayBuffer());
    assert.ok(mp4Buf.subarray(4, 8).toString('ascii') === 'ftyp', 'Expected valid ISO MP4 ftyp box');

    // Multi-provider credential boundary & orchestration fallback check
    const geminiBlock = await fetch(`${apiBase}/api/providers/google-gemini/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'should-reject' }),
    });
    assert.equal(geminiBlock.status, 400);

    const mockOpenAiText = await startMockServer((req, res) => {
      const url = req.url || '';
      if (url.startsWith('/v1/models')) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ data: [{ id: 'gpt-4.1-mini' }] }));
        return;
      }
      if (url.startsWith('/v1/chat/completions') && req.method === 'POST') {
        assert.equal(req.headers.authorization, 'Bearer test-openai-ephemeral');
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            choices: [{ message: { content: 'Orchestrated screenplay beat from mock OpenAI.' } }],
          })
        );
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    try {
      const credSave = await fetch(`${apiBase}/api/providers/openai/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: 'test-openai-ephemeral' }),
      }).then((r) => r.json() as Promise<{ hasCredential: boolean; source: string }>);
      assert.equal(credSave.hasCredential, true);
      assert.equal(credSave.source, 'session_memory');

      const credRead = await fetch(`${apiBase}/api/providers/credentials`).then((r) => r.text());
      assert.equal(credRead.includes('test-openai-ephemeral'), false, 'Secret must never appear in credential status payload');

      const providerTest = await fetch(`${apiBase}/api/providers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: {
            id: 'openai',
            kind: 'openai',
            name: 'OpenAI Platform',
            category: 'commercial',
            enabled: true,
            baseUrl: mockOpenAiText.baseUrl,
            defaultModelId: 'gpt-4.1-mini',
            availableModels: ['gpt-4.1-mini'],
            capabilities: ['text_generation', 'long_form_reasoning', 'structured_output'],
            requiresCredentials: true,
            inputTypes: ['text'],
            outputTypes: ['text'],
          },
        }),
      }).then((r) => r.json() as Promise<{ connected: boolean; discoveredModels: string[] }>);
      assert.equal(providerTest.connected, true);
      assert.ok(providerTest.discoveredModels.includes('gpt-4.1-mini'));

      const orchRes = await fetch(`${apiBase}/api/orchestration/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: 'screenplay_development',
          prompt: 'Draft a 1-paragraph documentary logline.',
          providers: [
            {
              id: 'openai',
              kind: 'openai',
              name: 'OpenAI Platform',
              category: 'commercial',
              enabled: true,
              baseUrl: mockOpenAiText.baseUrl,
              defaultModelId: 'gpt-4.1-mini',
              availableModels: ['gpt-4.1-mini'],
              capabilities: ['text_generation', 'long_form_reasoning', 'structured_output'],
              requiresCredentials: true,
              inputTypes: ['text'],
              outputTypes: ['text'],
            },
          ],
          routingRules: [
            {
              taskType: 'screenplay_development',
              label: 'Screenplay',
              description: 'Test',
              requiredCapabilities: ['text_generation', 'long_form_reasoning'],
              primaryProviderId: 'google-gemini',
              primaryModelId: 'gemini-4-hydrogen',
              fallbackProviderId: 'openai',
              fallbackModelId: 'gpt-4.1-mini',
              priority: 'quality',
              timeoutMs: 8000,
              maxRetries: 0,
              allowManualOverride: true,
              allowOfflineSimulation: false,
            },
          ],
        }),
      }).then((r) => r.json() as Promise<{ providerUsed: string; usedFallback: boolean; outputText: string }>);

      assert.equal(orchRes.providerUsed, 'openai');
      assert.equal(orchRes.usedFallback, true);
      assert.match(orchRes.outputText, /Orchestrated screenplay beat/);
    } finally {
      mockOpenAiText.server.close();
    }
  } finally {
    apiServer.close();
    mockComfy.server.close();
    mockQwen.server.close();
    mockAuthRequired.server.close();
  }
});
