import { validateExternalServiceUrl } from './urlGuard';

export function resolveQwenEndpoint(rawUrl?: string): string {
  return (rawUrl || '').trim() || (process.env.QWEN_VL_ENDPOINT_URL || '').trim();
}

export function resolveQwenModel(rawModel?: string): string {
  return (rawModel || '').trim() || (process.env.QWEN_VL_MODEL_ID || '').trim() || 'Qwen/Qwen2.5-VL-3B-Instruct';
}

function buildQwenHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = (process.env.QWEN_VL_API_KEY || '').trim();
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

export async function testQwenEndpoint(rawUrl?: string): Promise<{
  connected: boolean;
  url: string;
  latencyMs: number | null;
  models: string[];
  authConfigured: boolean;
  error?: string;
}> {
  const candidate = resolveQwenEndpoint(rawUrl);
  const authConfigured = Boolean((process.env.QWEN_VL_API_KEY || '').trim());
  const check = validateExternalServiceUrl(candidate);

  if (!check.valid || !check.normalizedUrl) {
    return {
      connected: false,
      url: candidate,
      latencyMs: null,
      models: [],
      authConfigured,
      error: check.error || 'Invalid Qwen2.5-VL endpoint URL.',
    };
  }

  const start = Date.now();
  try {
    const res = await fetch(`${check.normalizedUrl}/v1/models`, {
      headers: buildQwenHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return {
        connected: false,
        url: check.normalizedUrl,
        latencyMs,
        models: [],
        authConfigured,
        error:
          res.status === 401 || res.status === 403
            ? `Authentication required (HTTP ${res.status}). Configure QWEN_VL_API_KEY on the server.`
            : `Vision endpoint returned HTTP ${res.status}`,
      };
    }

    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const models = (data.data || []).map((m) => m.id).filter((id): id is string => Boolean(id));
    return {
      connected: true,
      url: check.normalizedUrl,
      latencyMs,
      models,
      authConfigured,
    };
  } catch (err) {
    return {
      connected: false,
      url: check.normalizedUrl,
      latencyMs: null,
      models: [],
      authConfigured,
      error: err instanceof Error ? err.message : 'Vision endpoint unreachable.',
    };
  }
}

function parseJsonResponseLenient(rawText: string): Record<string, unknown> {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    }
    throw new Error('Qwen endpoint did not return parseable JSON visual attributes.');
  }
}

export async function analyzeImageWithQwen(input: {
  endpointUrl?: string;
  modelId?: string;
  assetId: string;
  base64Data: string;
  mimeType?: string;
}) {
  const candidate = resolveQwenEndpoint(input.endpointUrl);
  const check = validateExternalServiceUrl(candidate);
  if (!check.valid || !check.normalizedUrl) {
    throw new Error(check.error || 'Invalid Qwen2.5-VL endpoint URL.');
  }
  if (!input.base64Data) {
    throw new Error('base64Data is required.');
  }

  const resolvedModel = resolveQwenModel(input.modelId);
  const dataUri = input.base64Data.startsWith('data:')
    ? input.base64Data
    : `data:${input.mimeType || 'image/jpeg'};base64,${input.base64Data}`;

  const bodyPayload = JSON.stringify({
    model: resolvedModel,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              'Analyze this image for music video production. Describe ONLY directly observable details (write "Not visible" for absent traits). ' +
              'Respond ONLY with valid JSON containing: description, identifiedSubjects (string[]), suggestedSceneCategories (string[]), ' +
              'suggestedCinematicTreatment (string), and visualAttributes (mainSubjects, humanSubjects, clothing, hairstyle, facialCharacteristics, pose, bodyOrientation, environment, background, lighting, cameraPerspective, composition, objects, colors, visualStyle, emotionalExpression, imageQuality).',
          },
          { type: 'image_url', image_url: { url: dataUri } },
        ],
      },
    ],
    temperature: 0.2,
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const upstream = await fetch(`${check.normalizedUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: buildQwenHeaders(),
        body: bodyPayload,
        signal: AbortSignal.timeout(28000),
      });

      if (!upstream.ok) {
        const text = await upstream.text();
        const err = new Error(`Vision endpoint returned HTTP ${upstream.status}: ${text.slice(0, 240)}`);
        if (upstream.status >= 500 && attempt < 2) {
          lastError = err;
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw err;
      }

      const payload = (await upstream.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = payload.choices?.[0]?.message?.content || '{}';
      const parsed = parseJsonResponseLenient(rawContent);

      return {
        assetId: input.assetId,
        provider: 'qwen-vl' as const,
        modelName: resolvedModel,
        analyzedAt: new Date().toISOString(),
        userEdited: false,
        confidence: 0.85,
        ...parsed,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('External vision inference failed.');
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error('External vision inference failed after retries.');
}
