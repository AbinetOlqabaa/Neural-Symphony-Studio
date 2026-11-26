import { GoogleGenAI, Type } from '@google/genai';

export const ALLOWED_GEMINI_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;
export type AllowedGeminiModel = (typeof ALLOWED_GEMINI_MODELS)[number];

export function resolveGeminiModel(requested?: string): AllowedGeminiModel {
  const candidate = (requested || '').trim() || (process.env.GEMINI_MODEL || '').trim();
  if (ALLOWED_GEMINI_MODELS.includes(candidate as AllowedGeminiModel)) {
    return candidate as AllowedGeminiModel;
  }
  return 'gemini-4-hydrogen';
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs = 25000, label = 'Gemini request'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function translateGeminiError(err: unknown): { statusCode: number; message: string } {
  const raw = err instanceof Error ? err.message : 'Gemini request failed.';
  const lower = raw.toLowerCase();

  if (lower.includes('429') || lower.includes('quota') || lower.includes('rate limit')) {
    return {
      statusCode: 429,
      message: 'Gemini API rate limit or quota reached. Wait briefly before retrying or switch to Qwen2.5-VL.',
    };
  }
  if (lower.includes('401') || lower.includes('403') || lower.includes('api key')) {
    return {
      statusCode: 401,
      message: 'Gemini API authentication failed on the server. Verify GEMINI_API_KEY in AI Studio Secrets.',
    };
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return {
      statusCode: 404,
      message: 'Configured Gemini model is unavailable. Verify GEMINI_MODEL selection.',
    };
  }
  if (lower.includes('timed out')) {
    return { statusCode: 504, message: raw };
  }
  return { statusCode: 502, message: raw };
}

export async function analyzeImageWithGemini(input: {
  assetId: string;
  base64Data: string;
  mimeType: string;
  fileName: string;
  model?: string;
}) {
  const ai = getGeminiClient();
  const modelName = resolveGeminiModel(input.model);
  const cleanBase64 = input.base64Data.includes(',') ? input.base64Data.split(',')[1] : input.base64Data;

  const response = await runWithTimeout(
    ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: input.mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text:
              `Analyze this image ("${input.fileName}") for a cinematic music video production studio. ` +
              'Describe ONLY directly observable visual attributes. Do not invent unseen details. ' +
              'If an attribute is not visible (e.g., no human subject), state "Not visible".',
          },
        ],
      },
      config: {
        systemInstruction:
          'You are a cinematography and visual continuity analyst. Return accurate structured JSON describing strictly observable details.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            identifiedSubjects: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidence: { type: Type.NUMBER },
            suggestedSceneCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestedCinematicTreatment: { type: Type.STRING },
            visualAttributes: {
              type: Type.OBJECT,
              properties: {
                mainSubjects: { type: Type.ARRAY, items: { type: Type.STRING } },
                humanSubjects: { type: Type.STRING },
                clothing: { type: Type.STRING },
                hairstyle: { type: Type.STRING },
                facialCharacteristics: { type: Type.STRING },
                pose: { type: Type.STRING },
                bodyOrientation: { type: Type.STRING },
                environment: { type: Type.STRING },
                background: { type: Type.STRING },
                lighting: { type: Type.STRING },
                cameraPerspective: { type: Type.STRING },
                composition: { type: Type.STRING },
                objects: { type: Type.ARRAY, items: { type: Type.STRING } },
                colors: { type: Type.ARRAY, items: { type: Type.STRING } },
                visualStyle: { type: Type.STRING },
                emotionalExpression: { type: Type.STRING },
                imageQuality: { type: Type.STRING },
              },
            },
          },
        },
      },
    }),
    25000,
    'Gemini image analysis'
  );

  const rawJson = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawJson);
  return {
    assetId: input.assetId,
    provider: 'gemini' as const,
    modelName,
    analyzedAt: new Date().toISOString(),
    userEdited: false,
    ...parsed,
  };
}

export async function generateScenePlanWithGemini(input: {
  projectName: string;
  projectDescription: string;
  assetsSummary: Array<{ id: string; fileName: string; description: string }>;
  charactersSummary: Array<{ id: string; name: string; appearance: string }>;
  lyricsExcerpt: string;
  model?: string;
}) {
  const ai = getGeminiClient();
  const modelName = resolveGeminiModel(input.model);

  const prompt = [
    `Project: ${input.projectName}`,
    `Concept: ${input.projectDescription}`,
    `Available Reference Assets: ${JSON.stringify(input.assetsSummary)}`,
    `Character Bible: ${JSON.stringify(input.charactersSummary)}`,
    `Lyrics / Mood Excerpt:\n${input.lyricsExcerpt || 'Instrumental / no lyrics supplied yet.'}`,
    'Propose 3 to 5 cohesive music video scenes using ONLY the provided asset IDs and character IDs.',
  ].join('\n\n');

  const response = await runWithTimeout(
    ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a music video director and cinematographer. Generate structured scene plans linking existing referenceAssetIds and characterIds.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              referenceAssetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              characterIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              environmentDescription: { type: Type.STRING },
              composition: { type: Type.STRING },
              cameraFraming: { type: Type.STRING },
              lighting: { type: Type.STRING },
              motionDirection: { type: Type.STRING },
              cameraMovement: { type: Type.STRING },
              durationSeconds: { type: Type.NUMBER },
              narrativePurpose: { type: Type.STRING },
            },
          },
        },
      },
    }),
    25000,
    'Gemini scene planning'
  );

  return JSON.parse((response.text ?? '[]').trim());
}

export async function synthesizePromptWithGemini(input: {
  engine: string;
  sceneTitle: string;
  sceneDescription: string;
  characterInstructions: string;
  userNotes: string;
  model?: string;
}) {
  const ai = getGeminiClient();
  const modelName = resolveGeminiModel(input.model);

  const response = await runWithTimeout(
    ai.models.generateContent({
      model: modelName,
      contents:
        `Adapt a video generation positive and negative prompt for engine "${input.engine}".\n` +
        `Scene: ${input.sceneTitle} — ${input.sceneDescription}\n` +
        `Character Continuity: ${input.characterInstructions}\n` +
        `Director Notes: ${input.userNotes || 'None'}`,
      config: {
        systemInstruction:
          'Return JSON with positivePrompt and negativePrompt tailored to the requested video generation model.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            positivePrompt: { type: Type.STRING },
            negativePrompt: { type: Type.STRING },
          },
        },
      },
    }),
    20000,
    'Gemini prompt synthesis'
  );

  return JSON.parse((response.text ?? '{}').trim());
}
