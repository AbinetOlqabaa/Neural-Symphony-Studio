import type { CharacterEntry, EngineId, ImageAnalysis, ScenePlan } from '../../types/studio';

export interface PromptBuildInput {
  scene: ScenePlan;
  characters: CharacterEntry[];
  analyses: ImageAnalysis[];
  engine: EngineId;
  customStyle?: string;
}

export interface CompiledPromptOutput {
  positivePrompt: string;
  negativePrompt: string;
  characterConsistencyBlock: string;
  sceneConsistencyBlock: string;
  cameraMovementBlock: string;
  motionBlock: string;
  lightingBlock: string;
  styleBlock: string;
  estimatedTokens: number;
}

export function estimatePromptTokens(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  const words = cleaned.split(/\s+/).length;
  const charEstimate = Math.ceil(cleaned.length / 3.8);
  return Math.max(words, charEstimate);
}

export function compileStructuredPrompt(input: PromptBuildInput): CompiledPromptOutput {
  const { scene, characters, analyses, engine, customStyle } = input;

  const matchedChars = characters.filter((c) => scene.characterIds.includes(c.id));
  const characterConsistencyBlock = matchedChars
    .map((c) => {
      const parts = [
        `${c.name} (${c.approximateAgeCategory})`,
        c.facialDescription,
        c.hairstyle,
        c.clothing,
        c.accessories && c.accessories !== 'None' ? `wearing ${c.accessories}` : '',
        c.identityPreservationInstructions,
      ].filter(Boolean);
      return parts.join(', ');
    })
    .join('; ');

  const analysisContext = analyses
    .map((a) => `${a.visualAttributes.environment}, ${a.visualAttributes.colors.slice(0, 3).join(' ')} palette`)
    .filter(Boolean)
    .slice(0, 2)
    .join(' | ');

  const sceneConsistencyBlock = [
    scene.environmentDescription,
    scene.composition,
    analysisContext,
  ]
    .filter(Boolean)
    .join('. ');

  const cameraMovementBlock = [scene.cameraFraming, scene.cameraMovement].filter(Boolean).join(', ');
  const motionBlock = scene.motionDirection || 'natural subtle breathing and micro-expression movement';
  const lightingBlock = scene.lighting || 'cinematic balanced twilight illumination';
  const styleBlock =
    customStyle ||
    (engine === 'ltx-video'
      ? 'Continuous 35mm film motion, physically coherent lighting, crisp texture fidelity'
      : engine === 'wan-2.1'
      ? 'High-definition cinematic music video shot, temporal stability, rich dynamic range'
      : 'Cinematic film grain, consistent temporal geometry, natural color grading');

  let positivePrompt = '';
  let negativePrompt = '';

  if (engine === 'ltx-video') {
    // LTX-Video responds best to continuous descriptive prose rather than tag lists
    positivePrompt = [
      `${scene.cameraFraming} shot: ${scene.description}.`,
      characterConsistencyBlock ? `Subject continuity: ${characterConsistencyBlock}.` : '',
      `Environment: ${sceneConsistencyBlock}.`,
      `Motion: ${motionBlock}, camera performs ${scene.cameraMovement}.`,
      `Lighting and style: ${lightingBlock}, ${styleBlock}.`,
    ]
      .filter(Boolean)
      .join(' ');
    negativePrompt =
      'morphing face, changing clothes, inconsistent hair, jittery motion, distorted hands, flickering background, text watermark, low-res artifacts, abrupt jump cut';
  } else if (engine === 'wan-2.1') {
    positivePrompt = [
      `${cameraMovementBlock}. ${scene.description}`,
      characterConsistencyBlock ? `Character lock: ${characterConsistencyBlock}` : '',
      `Setting: ${sceneConsistencyBlock}`,
      `Action: ${motionBlock}`,
      `Lighting: ${lightingBlock}. ${styleBlock}`,
    ]
      .filter(Boolean)
      .join('. ');
    negativePrompt =
      'identity drift, extra limbs, blurred facial features, static freeze frame, oversaturated neon artifacts, frame tearing, watermark, compression noise';
  } else {
    positivePrompt = [
      scene.description,
      characterConsistencyBlock,
      sceneConsistencyBlock,
      cameraMovementBlock,
      motionBlock,
      lightingBlock,
      styleBlock,
    ]
      .filter(Boolean)
      .join(', ');
    negativePrompt =
      'blurry, deformed anatomy, inconsistent identity, flicker, artifacts, text overlay, watermark, cropped head';
  }

  return {
    positivePrompt,
    negativePrompt,
    characterConsistencyBlock,
    sceneConsistencyBlock,
    cameraMovementBlock,
    motionBlock,
    lightingBlock,
    styleBlock,
    estimatedTokens: estimatePromptTokens(positivePrompt) + estimatePromptTokens(negativePrompt),
  };
}
