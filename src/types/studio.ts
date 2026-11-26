export type NavSection =
  | 'dashboard'
  | 'projects'
  | 'creative'
  | 'screenplay'
  | 'breakdown'
  | 'characters'
  | 'costumes'
  | 'locations'
  | 'props'
  | 'storyboard'
  | 'shots'
  | 'schedule'
  | 'documents'
  | 'continuity'
  | 'media'
  | 'intelligence'
  | 'scenes'
  | 'prompts'
  | 'generation'
  | 'queue'
  | 'timeline'
  | 'music'
  | 'export'
  | 'workflows'
  | 'providers'
  | 'models'
  | 'routing'
  | 'monitor'
  | 'settings';

export type ThemeMode = 'dark' | 'light';

export type ProjectStatus = 'draft' | 'in_production' | 'review' | 'completed' | 'archived';

export type EngineId = 'comfyui' | 'ltx-video' | 'wan-2.1';

export type VisionProviderId = 'gemini' | 'qwen-vl';

export type ProductionLanguage = 'en' | 'am' | 'om' | 'ti';

export type ProductionCategory =
  | 'music_video'
  | 'short_film'
  | 'feature_film'
  | 'documentary'
  | 'commercial_ad'
  | 'social_ad'
  | 'educational'
  | 'historical_documentary'
  | 'promotional'
  | 'training'
  | 'multilingual';

export type ProviderCategory = 'commercial' | 'open_source_self_hosted' | 'specialized';

export type ProviderKind =
  | 'google-gemini'
  | 'openai'
  | 'anthropic'
  | 'qwen-vl'
  | 'ollama'
  | 'openai-compatible'
  | 'comfyui';

export type ProviderCapability =
  | 'text_generation'
  | 'long_form_reasoning'
  | 'structured_output'
  | 'image_understanding'
  | 'image_generation'
  | 'image_to_video'
  | 'text_to_speech'
  | 'speech_to_text'
  | 'translation'
  | 'subtitle_generation';

export type ProviderConnectionStatus =
  | 'configured'
  | 'connected'
  | 'available'
  | 'unavailable'
  | 'requires_credentials'
  | 'requires_external_infrastructure'
  | 'offline_simulation';

export type CostClassification = 'free_tier' | 'paid_api' | 'local_self_hosted' | 'hybrid_unknown';

export type QualityTier = 'preferred_quality' | 'balanced' | 'low_cost' | 'local_offline' | 'experimental';

export type RoutingPriority = 'quality' | 'cost' | 'speed' | 'local';

export type TaskType =
  | 'screenplay_development'
  | 'image_analysis'
  | 'storyboard_image_creation'
  | 'image_to_video'
  | 'voice_generation'
  | 'localization'
  | 'prompt_synthesis';

export interface CostMetadata {
  classification: CostClassification;
  estimatedInputPer1MTokens?: number;
  estimatedOutputPer1MTokens?: number;
  estimatedImageCost?: number;
  estimatedVideoCost?: number;
  currency: string;
  lastVerifiedDate?: string;
  licensingNotes?: string;
}

export interface AIProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  category: ProviderCategory;
  enabled: boolean;
  baseUrl?: string;
  defaultModelId: string;
  availableModels: string[];
  capabilities: ProviderCapability[];
  requiresCredentials: boolean;
  authEnvVarName?: string;
  inputTypes: string[];
  outputTypes: string[];
  notes?: string;
  isCustom?: boolean;
}

export interface AIModelEntry {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  category:
    | 'text_language'
    | 'image_understanding'
    | 'image_generation'
    | 'video_generation'
    | 'audio';
  capabilities: ProviderCapability[];
  supportsImageInput: boolean;
  supportsStructuredOutput: boolean;
  supportsToolCalling: boolean;
  contextWindowTokens?: number;
  qualityTier: QualityTier;
  cost: CostMetadata;
  supportedLanguages: string[];
  notes?: string;
}

export interface TaskRoutingRule {
  taskType: TaskType;
  label: string;
  description: string;
  requiredCapabilities: ProviderCapability[];
  primaryProviderId: string;
  primaryModelId: string;
  fallbackProviderId?: string;
  fallbackModelId?: string;
  priority: RoutingPriority;
  timeoutMs: number;
  maxRetries: number;
  allowManualOverride: boolean;
  allowOfflineSimulation: boolean;
}

export interface ServerCredentialStatus {
  providerId: string;
  hasCredential: boolean;
  source: 'env' | 'session_memory' | 'none';
  envVarName?: string;
}

export type AssetCategory = 'character' | 'environment' | 'prop' | 'style_reference' | 'storyboard';

export type MediaType = 'image' | 'video' | 'audio';

export type ComfyConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'authentication_required'
  | 'unreachable'
  | 'configuration_invalid'
  | 'unknown';

export interface MediaAsset {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  mediaType: MediaType;
  category: AssetCategory;
  width: number;
  height: number;
  fileSizeBytes: number;
  sha256: string;
  dataUrl: string;
  thumbnailUrl: string;
  uploadedAt: string;
  sourceArchive?: string;
  uploadStatus: 'ready' | 'processing' | 'error';
  characterIds: string[];
  sceneIds: string[];
  isDemoAsset?: boolean;
}

export interface VisualAttributes {
  mainSubjects: string[];
  humanSubjects: string;
  clothing: string;
  hairstyle: string;
  facialCharacteristics: string;
  pose: string;
  bodyOrientation: string;
  environment: string;
  background: string;
  lighting: string;
  cameraPerspective: string;
  composition: string;
  objects: string[];
  colors: string[];
  visualStyle: string;
  emotionalExpression: string;
  imageQuality: string;
}

export interface ImageAnalysis {
  assetId: string;
  assetSha256?: string;
  provider: VisionProviderId | 'demo_seed';
  modelName: string;
  analyzedAt: string;
  description: string;
  visualAttributes: VisualAttributes;
  identifiedSubjects: string[];
  confidence: number;
  suggestedSceneCategories: string[];
  suggestedCinematicTreatment: string;
  userEdited: boolean;
  notes?: string;
}

export type CharacterCategory =
  | 'lead'
  | 'supporting'
  | 'ensemble'
  | 'narrator'
  | 'historical'
  | 'cameo';

export interface CharacterVersionEntry {
  version: number;
  createdAt: string;
  summary: string;
  snapshot: {
    name: string;
    label: string;
    description: string;
    facialDescription: string;
    hairstyle: string;
    clothing: string;
    identityPreservationInstructions: string;
  };
}

export interface CharacterEntry {
  id: string;
  name: string;
  label: string;
  referenceAssetIds: string[];
  primaryReferenceAssetId?: string;
  distinguishingCharacteristics: string;
  facialDescription: string;
  hairstyle: string;
  clothing: string;
  accessories: string;
  approximateAgeCategory: string;
  typicalPose: string;
  appearanceConstraints: string;
  identityPreservationInstructions: string;
  associatedAssetIds: string[];
  associatedSceneIds: string[];
  matchConfidence: number;
  needsHumanReview: boolean;
  reviewedByHuman: boolean;
  // Phase C Character Bible extensions (optional for v1/v2.0 compatibility)
  alternativeNames?: string;
  ageRange?: string;
  gender?: string;
  characterCategory?: CharacterCategory;
  narrativeRole?: string;
  description?: string;
  development?: {
    personality: string;
    background: string;
    motivation: string;
    goals: string;
    fears: string;
    strengths: string;
    weaknesses: string;
    relationships: string;
    characterArc: string;
    importantEvents: string;
  };
  visualIdentity?: {
    facialStructure: string;
    skinTone: string;
    eyes: string;
    bodyProportions: string;
    generalAppearance: string;
    voiceDescription: string;
    defaultClothingStyle: string;
  };
  references?: {
    approvedPortraitAssetId?: string;
    frontAssetIds: string[];
    sideProfileAssetIds: string[];
    fullBodyAssetIds: string[];
    expressionAssetIds: string[];
    characterPrompt: string;
  };
  approved?: boolean;
  version?: number;
  versionHistory?: CharacterVersionEntry[];
  updatedAt?: string;
}

export type SceneStatus = 'planned' | 'prompt_ready' | 'generating' | 'review' | 'approved';

export interface GenerationParameters {
  engine: EngineId;
  modelName: string;
  width: number;
  height: number;
  frameCount: number;
  fps: number;
  steps: number;
  guidanceScale: number;
  seed: number;
  motionStrength: number;
}

export type InteriorExterior = 'INT' | 'EXT' | 'INT/EXT';

export interface ScenePlan {
  id: string;
  order: number;
  title: string;
  description: string;
  referenceAssetIds: string[];
  characterIds: string[];
  environmentDescription: string;
  composition: string;
  cameraFraming: string;
  lighting: string;
  motionDirection: string;
  cameraMovement: string;
  durationSeconds: number;
  narrativePurpose: string;
  positivePrompt: string;
  negativePrompt: string;
  selectedEngine: EngineId;
  generationSettings: GenerationParameters;
  status: SceneStatus;
  aiGenerated?: boolean;
  approvedForGeneration: boolean;
  // Phase C Scene Breakdown fields
  locationId?: string;
  costumeIds?: string[];
  propIds?: string[];
  interiorExterior?: InteriorExterior;
  timeOfDay?: string;
  importantObjects?: string;
  wardrobeRequirements?: string;
  environmentalConditions?: string;
  emotionalTone?: string;
  productionComplexity?: 'low' | 'medium' | 'high';
  visualRequirements?: string;
  dialogueSummary?: string;
  actionsSummary?: string;
  sourceScreenplayId?: string;
  sourceScreenplayVersion?: number;
  sourceScreenplayPassage?: string;
}

export interface PromptVersion {
  id: string;
  sceneId: string;
  engine: EngineId;
  version: number;
  createdAt: string;
  positivePrompt: string;
  negativePrompt: string;
  characterConsistencyBlock: string;
  sceneConsistencyBlock: string;
  cameraMovementBlock: string;
  motionBlock: string;
  lightingBlock: string;
  styleBlock: string;
  estimatedTokens: number;
  notes?: string;
}

export type JobStatus =
  | 'pending'
  | 'submitting'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted';

export interface ComfyOutputFileRef {
  filename: string;
  subfolder: string;
  type: 'output' | 'input' | 'temp';
  nodeId?: string;
  mediaKind: 'video' | 'image';
}

export interface GenerationJob {
  id: string;
  projectId: string;
  sceneId: string;
  engine: EngineId;
  modelName: string;
  workflowId?: string;
  status: JobStatus;
  mode: 'comfyui_live' | 'offline_simulation';
  progress: number;
  createdAt: string;
  submittedAt?: string;
  startedAt?: string;
  completedAt?: string;
  comfyPromptId?: string;
  currentNode?: string;
  uploadedImageName?: string;
  outputFiles?: ComfyOutputFileRef[];
  workflowJson?: Record<string, unknown>;
  parameters: GenerationParameters;
  positivePrompt: string;
  negativePrompt: string;
  outputClipId?: string;
  errorMessage?: string;
}

export type ClipApprovalState =
  | 'technically_generated'
  | 'visually_acceptable'
  | 'production_approved'
  | 'rejected';

export interface QualityChecklist {
  characterConsistency: 'pass' | 'issue' | 'unreviewed';
  facialConsistency: 'pass' | 'issue' | 'unreviewed';
  compositionPreservation: 'pass' | 'issue' | 'unreviewed';
  clothingConsistency: 'pass' | 'issue' | 'unreviewed';
  backgroundStability: 'pass' | 'issue' | 'unreviewed';
  anatomicalIntegrity: 'pass' | 'issue' | 'unreviewed';
  flickerFree: 'pass' | 'issue' | 'unreviewed';
  naturalMotion: 'pass' | 'issue' | 'unreviewed';
  noCorruption: 'pass' | 'issue' | 'unreviewed';
}

export interface VideoClip {
  id: string;
  sceneId: string;
  jobId: string;
  versionNumber: number;
  engine: EngineId;
  modelName: string;
  createdAt: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  seed: number;
  sourceReferenceAssetId?: string;
  previewVideoUrl?: string;
  thumbnailUrl: string;
  extractedFrames: string[];
  outputFiles?: ComfyOutputFileRef[];
  mode: 'comfyui_live' | 'offline_simulation';
  approvalState: ClipApprovalState;
  qualityChecklist: QualityChecklist;
  qualityNotes: string;
}

export interface AudioAsset {
  id: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  fileSizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
}

export interface LyricLine {
  id: string;
  section: string;
  text: string;
  language: string;
  startTimeSec: number;
  endTimeSec: number;
  sceneId?: string;
}

export type TransitionType = 'cut' | 'crossfade' | 'dip_to_black';

export interface TimelineBlock {
  id: string;
  sceneId: string;
  clipId?: string;
  title: string;
  startTimeSec: number;
  durationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  transitionIn: TransitionType;
  transitionDurationSec: number;
}

export interface TimelineConfiguration {
  fps: number;
  resolutionWidth: number;
  resolutionHeight: number;
  blocks: TimelineBlock[];
  showLyricsOverlay: boolean;
  zoomLevel: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  engine: EngineId;
  description: string;
  updatedAt: string;
  json: Record<string, unknown>;
}

export interface ExportSettings {
  format: 'mp4';
  width: number;
  height: number;
  fps: number;
  videoBitrateMbps: number;
  includeAudio: boolean;
  burnSubtitles: boolean;
}

export interface CreativeBrief {
  concept: string;
  briefSummary: string;
  logline: string;
  synopsis: string;
  treatment: string;
  theme: string;
  targetAudience: string;
  genre: string;
  category: ProductionCategory;
  intendedDurationSec: number;
  primaryLanguage: ProductionLanguage;
  targetLanguages: ProductionLanguage[];
  visualDirection: string;
  objectives: string;
  updatedAt: string;
  approved: boolean;
}

export interface DialogueBlock {
  id: string;
  characterId?: string;
  speakerName: string;
  language: ProductionLanguage;
  text: string;
  deliveryNotes?: string;
  localizedVariants?: Partial<Record<ProductionLanguage, string>>;
}

export interface ScreenplayRevision {
  version: number;
  createdAt: string;
  summary: string;
  snapshotText: string;
}

export interface ScreenplaySceneSection {
  id: string;
  order: number;
  linkedSceneId?: string;
  actNumber: number;
  sequenceName: string;
  slugline: string;
  sceneType: 'screenplay' | 'documentary' | 'advertisement' | 'music_video';
  actionDescription: string;
  narration: string;
  dialogueBlocks: DialogueBlock[];
  estimatedDurationSec: number;
  revision: number;
  approved: boolean;
  updatedAt: string;
  versionHistory: ScreenplayRevision[];
}

export type DocumentType =
  | 'creative_brief'
  | 'screenplay'
  | 'breakdown'
  | 'character_bible'
  | 'costume_bible'
  | 'location_bible'
  | 'props_inventory'
  | 'storyboard'
  | 'shot_list'
  | 'production_schedule'
  | 'preproduction_package';

export type DocumentStatus = 'draft' | 'in_review' | 'approved';

export interface DocumentComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
}

export interface DocumentVersionEntry {
  version: number;
  createdAt: string;
  contentMarkdown: string;
  summary: string;
}

export interface ProductionDocument {
  id: string;
  type: DocumentType;
  title: string;
  language: ProductionLanguage;
  contentMarkdown: string;
  structuredData?: Record<string, unknown>;
  version: number;
  versionHistory: DocumentVersionEntry[];
  status: DocumentStatus;
  comments: DocumentComment[];
  linkedSceneIds: string[];
  linkedCharacterIds: string[];
  updatedAt: string;
  aiAssisted?: boolean;
}

export interface CostumeSpec {
  id: string;
  name?: string;
  characterId: string;
  sceneIds: string[];
  storyTimeline?: string;
  narrativePurpose?: string;
  garmentDescription: string;
  garmentComponents?: string;
  fabric: string;
  color: string;
  pattern: string;
  accessories: string;
  footwear: string;
  weatherSuitability?: string;
  culturalContext: string;
  conditionState?: string;
  referenceAssetIds?: string[];
  generationPrompt?: string;
  continuityNotes: string;
  intentionalChangeNotes?: string;
  approved: boolean;
  updatedAt?: string;
}

export type LocationType = 'real_world' | 'studio' | 'fictional' | 'ai_generated';

export interface LocationSpec {
  id: string;
  name: string;
  sceneIds: string[];
  locationType?: LocationType;
  geographicInfo?: string;
  interiorExterior?: InteriorExterior;
  dayNightSuitability?: string;
  architecturalStyle: string;
  environmentDescription: string;
  timeOfDay: string;
  weather: string;
  environmentalConditions?: string;
  lighting: string;
  visualFeatures?: string;
  referenceAssetIds?: string[];
  environmentPrompt?: string;
  continuityNotes: string;
  approved?: boolean;
  updatedAt?: string;
}

export type PropCategory =
  | 'handheld'
  | 'background'
  | 'furniture'
  | 'vehicle'
  | 'set_decoration'
  | 'narrative_object';

export interface PropSceneState {
  sceneId: string;
  stateLabel: string;
  conditionNotes: string;
}

export interface PropSpec {
  id: string;
  name: string;
  category?: PropCategory;
  characterIds: string[];
  sceneIds: string[];
  locationId?: string;
  description: string;
  visualCharacteristics?: string;
  materials?: string;
  colors?: string;
  dimensions?: string;
  narrativeImportance?: 'hero' | 'featured' | 'background';
  referenceAssetIds?: string[];
  generationPrompt?: string;
  sceneStates?: PropSceneState[];
  approved?: boolean;
  updatedAt?: string;
}

export type StoryboardMode = 'text_only' | 'reference_image' | 'ai_generated';

export type StoryboardGenerationStatus =
  | 'planned'
  | 'requested'
  | 'generating'
  | 'generated'
  | 'failed';

export interface StoryboardFrameSpec {
  id: string;
  sceneId: string;
  frameNumber?: number;
  shotId?: string;
  shotNumber: string;
  visualDescription: string;
  cameraAngle: string;
  shotSize: string;
  cameraDistance?: string;
  cameraMovement: string;
  composition?: string;
  characterPositioning?: string;
  environment?: string;
  lighting: string;
  mood?: string;
  action: string;
  durationSec: number;
  characterIds?: string[];
  locationId?: string;
  costumeIds?: string[];
  propIds?: string[];
  referenceAssetId?: string;
  referenceAssetIds?: string[];
  generationPrompt: string;
  storyboardMode?: StoryboardMode;
  generationStatus?: StoryboardGenerationStatus;
  generatedImageUrl?: string;
  generationError?: string;
  approved: boolean;
  updatedAt?: string;
}

export type ShotPriority = 'must_have' | 'important' | 'optional';

export interface ShotSpec {
  id: string;
  sceneId: string;
  storyboardFrameId?: string;
  shotNumber: string;
  description?: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  lensGuidance: string;
  focalLengthMm?: string;
  cameraPosition?: string;
  cameraHeight?: string;
  framing?: string;
  composition?: string;
  subject?: string;
  characterPositioning?: string;
  characterMovement?: string;
  background?: string;
  lightingSetup?: string;
  colorPalette?: string;
  mood?: string;
  focus?: string;
  depthOfField?: string;
  priority?: ShotPriority;
  equipment?: string;
  personnel?: string;
  propIds?: string[];
  costumeIds?: string[];
  specialEffects?: string;
  audioRequirements?: string;
  notes?: string;
  linkedClipId?: string;
  durationSec: number;
  approved: boolean;
  updatedAt?: string;
}

export type ProductionTaskPhase = 'pre_production' | 'production' | 'post_production';
export type ProductionTaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface ProductionTask {
  id: string;
  phase: ProductionTaskPhase;
  title: string;
  description: string;
  responsiblePerson: string;
  startDate: string;
  endDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: ProductionTaskStatus;
  dependencyIds: string[];
  sceneId?: string;
  shotId?: string;
  notes?: string;
  updatedAt: string;
}

export interface ContinuityAlert {
  id: string;
  severity: 'warning' | 'info' | 'action_required';
  classification?: 'informational' | 'warning' | 'critical';
  category:
    | 'character'
    | 'costume'
    | 'location'
    | 'props'
    | 'screenplay'
    | 'storyboard'
    | 'shots'
    | 'reference';
  source: 'detected' | 'manual';
  title: string;
  description: string;
  affectedEntityIds: string[];
  affectedSection?: NavSection;
  intentionalDifference?: boolean;
  explanation?: string;
  createdAt: string;
  resolved: boolean;
}

export interface LanguageConfig {
  primaryLanguage: ProductionLanguage;
  targetLanguages: ProductionLanguage[];
  voiceProviderByLanguage: Partial<Record<ProductionLanguage, string>>;
  humanLinguisticReviewRequired: boolean;
}

export interface Project {
  id: string;
  schemaVersion?: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  isDemoProject?: boolean;
  settings: {
    defaultEngine: EngineId;
    defaultWidth: number;
    defaultHeight: number;
    defaultFps: number;
  };
  mediaAssets: MediaAsset[];
  analyses: Record<string, ImageAnalysis>;
  characters: CharacterEntry[];
  scenes: ScenePlan[];
  promptHistory: PromptVersion[];
  jobs: GenerationJob[];
  clips: VideoClip[];
  musicAsset?: AudioAsset;
  lyrics: LyricLine[];
  timeline: TimelineConfiguration;
  workflows: WorkflowTemplate[];
  exportSettings: ExportSettings;
  creativeBrief?: CreativeBrief;
  screenplay?: ScreenplaySceneSection[];
  productionDocuments?: ProductionDocument[];
  costumes?: CostumeSpec[];
  locations?: LocationSpec[];
  props?: PropSpec[];
  storyboardFrames?: StoryboardFrameSpec[];
  shotList?: ShotSpec[];
  productionTasks?: ProductionTask[];
  continuityAlerts?: ContinuityAlert[];
  languageConfig?: LanguageConfig;
  extraMetadata?: Record<string, unknown>;
}

export interface StudioSettings {
  theme: ThemeMode;
  comfyUiUrl: string;
  comfyTimeoutMs: number;
  qwenVlEndpointUrl: string;
  qwenVlModelId: string;
  geminiModel: string;
  ffmpegServiceUrl: string;
  defaultEngine: EngineId;
  autosaveSeconds: number;
  allowOfflineSimulation: boolean;
  aiProviders?: AIProviderConfig[];
  aiModels?: AIModelEntry[];
  routingRules?: TaskRoutingRule[];
  routingPriority?: RoutingPriority;
}

export interface ComfyUISystemStats {
  connected: boolean;
  status: ComfyConnectionStatus;
  url: string;
  latencyMs: number | null;
  comfyVersion?: string;
  pytorchVersion?: string;
  os?: string;
  gpuName?: string;
  vramTotalBytes?: number;
  vramFreeBytes?: number;
  ramTotalBytes?: number;
  ramFreeBytes?: number;
  authConfigured?: boolean;
  lastSuccessfulConnection?: string;
  error?: string;
  checkedAt: string;
}

export interface ComfyObjectInfoSummary {
  checkpoints: string[];
  unets: string[];
  loras: string[];
  nodeCount: number;
  nodeTypes: string[];
}

export interface ComfyExecutionEvent {
  type:
    | 'connected'
    | 'status'
    | 'execution_start'
    | 'executing'
    | 'progress'
    | 'executed'
    | 'execution_error'
    | 'execution_interrupted'
    | 'disconnected';
  promptId?: string;
  node?: string | null;
  value?: number;
  max?: number;
  progressPercent?: number;
  queueRemaining?: number;
  message?: string;
  timestamp: string;
}

export interface RenderJobStatus {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  stage: string;
  createdAt: string;
  completedAt?: string;
  outputFileName?: string;
  outputSizeBytes?: number;
  warnings?: string[];
  errorMessage?: string;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  category:
    | 'image_understanding'
    | 'video_generation'
    | 'image_generation'
    | 'audio'
    | 'text_language'
    | 'upscaling'
    | 'interpolation'
    | 'other';
  provider: string;
  providerId?: string;
  version: string;
  requiredEngine: string;
  status: 'installed' | 'configured' | 'not_connected' | 'unavailable';
  source: 'comfyui_live' | 'server_env' | 'manual_config';
  costClassification?: CostClassification;
  qualityTier?: QualityTier;
  capabilities?: ProviderCapability[];
  notes?: string;
}
