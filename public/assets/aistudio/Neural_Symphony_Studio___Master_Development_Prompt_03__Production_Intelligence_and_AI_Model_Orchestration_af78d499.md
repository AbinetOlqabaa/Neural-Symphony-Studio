# NEURAL SYMPHONY STUDIO
# MASTER DEVELOPMENT PROMPT 03
## AI MODEL ORCHESTRATION, PROFESSIONAL PRE-PRODUCTION AND MULTI-PROVIDER ARCHITECTURE

### 1. YOUR ROLE

You are continuing development of the existing Neural Symphony Studio application.

Act as a principal software architect, AI orchestration engineer, professional film-production workflow designer, and senior full-stack developer.

You must continue from the actual existing source code.

You are NOT starting a new project.

You must preserve all existing working functionality, including:

- React + Vite frontend.
- Express backend.
- IndexedDB project persistence.
- Project export/import.
- ComfyUI integration.
- LTX-Video 0.9.5 adapter.
- Wan 2.1 adapter.
- Gemini integration.
- Qwen2.5-VL integration.
- FFmpeg rendering.
- Generation queue.
- Multilingual lyrics synchronization.
- Existing sixteen production sections.
- Offline Simulation Mode.
- Multi-account development continuity documentation.

Do not rebuild completed features unnecessarily.

Do not remove existing functionality.

Inspect before modifying.

---

# 2. NEW PRODUCT DIRECTION

Neural Symphony Studio is evolving from an AI video-generation application into a comprehensive AI-assisted film, documentary, advertising, and multimedia production platform.

The application should eventually support the complete production lifecycle:

IDEA
→ CREATIVE DEVELOPMENT
→ SCRIPTWRITING
→ PRE-PRODUCTION
→ VISUAL DEVELOPMENT
→ STORYBOARDING
→ PRODUCTION PLANNING
→ AI VIDEO GENERATION
→ AUDIO PRODUCTION
→ POST-PRODUCTION
→ LOCALIZATION
→ FINAL DELIVERY

The platform must support different production categories:

- Commercial advertisements.
- Social media advertising.
- Music videos.
- Short films.
- Feature films.
- Documentaries.
- Educational films.
- Historical documentaries.
- Promotional films.
- Training videos.
- Multilingual productions.

Do not attempt to implement every advanced production capability immediately.

Build a modular foundation that can expand progressively.

---

# 3. FIRST TASK: INSPECT THE EXISTING APPLICATION

Read the existing development and handoff documentation.

Inspect:

- Application architecture.
- Project data model.
- Existing Settings page.
- AI integration routes.
- Provider configurations.
- Existing model adapters.
- Character and scene intelligence.
- Prompt Studio.
- Generation Studio.
- Video timeline.
- Export subsystem.
- Existing tests.

Identify which components can be extended and which need architectural improvements.

Create:

docs/development/PRODUCTION_INTELLIGENCE_AUDIT.md

Document the existing architecture, gaps, proposed changes, and backward-compatibility requirements.

Do not destroy or replace working features.

---

# 4. AI MODEL ORCHESTRATION ENGINE

Create a central AI Model Orchestration subsystem.

This is a major architectural component.

Its responsibility is to coordinate multiple AI providers and assign appropriate models to production tasks.

The application must not be permanently dependent on one provider.

## 4.1 Provider Architecture

Support the following provider categories:

### Commercial AI providers

- OpenAI.
- Google Gemini.
- Anthropic Claude.
- Other compatible providers in the future.

### Open-source and self-hosted providers

- Qwen.
- Ollama-compatible models.
- OpenAI-compatible inference servers.
- vLLM-compatible endpoints where supported.
- Other configurable inference endpoints.

### Specialized AI providers

- Vision-language models.
- Image generation models.
- Video generation models.
- Text-to-speech models.
- Speech recognition models.
- Music generation models.
- Video processing services.

Implement provider adapters rather than scattering provider-specific API calls throughout the application.

## 4.2 Provider Registry

Create a centralized registry containing:

- Provider ID.
- Provider name.
- Provider category.
- API base URL where applicable.
- Model identifiers.
- Supported capabilities.
- Authentication requirements.
- Configuration status.
- Availability status.
- Connection status.
- Cost classification.
- Supported input types.
- Supported output types.

The registry must distinguish:

- Configured.
- Connected.
- Available.
- Unavailable.
- Requires credentials.
- Requires external infrastructure.
- Offline simulation.

Do not fabricate model availability.

## 4.3 Initial Model Configuration

Prepare support for:

OpenAI:
- Configurable API key.
- Configurable model identifier.
- Supported text and multimodal capabilities.

Google:
- Gemini API configuration.
- Configurable model identifier.
- Existing Gemini integration reuse.

Anthropic:
- Configurable API key.
- Configurable model identifier.
- Server-side integration.

Open-source:
- Qwen.
- Ollama.
- OpenAI-compatible inference endpoints.

Do not hard-code model names throughout the application.

Allow model identifiers to be configured independently of provider implementation.

Do not assume that every model supports image inputs, structured output, tool calling, or long context.

Inspect the actual capabilities of each configured provider.

---

# 5. SECURE AI PROVIDER SETTINGS

Extend the existing Settings section.

Create a dedicated:

AI PROVIDERS & MODEL CONFIGURATION

interface.

Users should be able to:

- Add a provider.
- Edit provider configuration.
- Configure model identifiers.
- Enter API credentials.
- Test connections.
- Enable or disable providers.
- Select preferred models.
- Configure fallback providers.
- View service status.
- Remove provider configurations.

Security is critical.

API keys must never be exposed to frontend JavaScript.

Do not store API keys in:

- IndexedDB.
- localStorage.
- Exported project ZIP files.
- Client-side project metadata.
- Browser-readable configuration files.

Use secure server-side secret storage supported by the deployment environment.

Inspect the current platform's available secret-management capabilities before implementing credential persistence.

If persistent encrypted secret storage is unavailable, use server environment variables and explain how to configure them.

Never invent credentials.

Never make API credentials mandatory for application startup.

The application must work in an unconfigured state.

---

# 6. TASK-BASED MODEL ROUTING

Create a task-based model routing system.

Different production tasks require different AI capabilities.

Examples:

TASK: SCREENPLAY DEVELOPMENT

Preferred capabilities:
- Long-form reasoning.
- Creative writing.
- Structured output.
- Narrative consistency.

TASK: IMAGE ANALYSIS

Preferred capabilities:
- Image understanding.
- Visual description.
- Character recognition.
- Scene understanding.

TASK: STORYBOARD IMAGE CREATION

Preferred capabilities:
- Image generation.
- Reference-image conditioning.
- Style consistency.

TASK: IMAGE-TO-VIDEO

Preferred capabilities:
- Image-to-video generation.
- Character consistency.
- Motion control.

TASK: VOICE GENERATION

Preferred capabilities:
- Text-to-speech.
- Language support.
- Voice consistency.

TASK: LOCALIZATION

Preferred capabilities:
- Translation.
- Linguistic understanding.
- Cultural adaptation.
- Subtitle generation.

The routing engine must select providers based on actual capability compatibility.

Support:

- Primary model.
- Secondary fallback model.
- Optional manual model selection.
- Provider availability checks.
- Error reporting.
- Retry policies.
- Configurable timeouts.

Do not silently switch to a lower-quality model without informing the user.

Do not assume an open-source model is free to operate. Distinguish software licensing from hosting, GPU, storage, and inference costs.

---

# 7. PROFESSIONAL AI PRE-PRODUCTION STUDIO

Create a new major application section:

PRODUCTION DEVELOPMENT

This section should turn a creative idea into a professionally structured production package.

The user should be able to start with a simple description of an idea.

Example:

"Create a 15-minute documentary exploring the historical architecture, traditional music, cultural heritage, and community life of northern Ethiopia."

The AI assistant should help transform the idea into structured production documents.

Implement the following modules progressively.

## 7.1 Creative Development

Generate and edit:

- Project concept.
- Creative brief.
- Logline.
- Synopsis.
- Treatment.
- Theme.
- Target audience.
- Genre.
- Intended duration.
- Visual direction.
- Production objectives.

Provide structured editable documents.

## 7.2 Screenplay and Script Studio

Support:

- Screenplay development.
- Documentary scripts.
- Advertisement scripts.
- Narration.
- Dialogue.
- Scene descriptions.
- Act structure.
- Sequence structure.
- Script revisions.

Support professionally organized screenplay sections.

Allow users to edit, approve, compare, and version scripts.

Keep scenes linked to the screenplay.

Do not generate disconnected script documents that cannot be traced to the actual production scenes.

## 7.3 Production Breakdown

Generate structured breakdowns containing:

- Scene number.
- Scene title.
- Location.
- Characters.
- Wardrobe.
- Props.
- Set requirements.
- Time of day.
- Lighting requirements.
- Special requirements.
- Dialogue.
- Sound requirements.
- Visual effects requirements.

Allow manual correction.

## 7.4 Character Bible

Extend the existing Character Intelligence subsystem.

Support:

- Character ID.
- Character name.
- Biography.
- Personality.
- Narrative purpose.
- Appearance.
- Facial reference.
- Hairstyle.
- Body and pose references.
- Costume specifications.
- Accessories.
- Age category.
- Character relationships.
- Voice characteristics.
- Character development.
- Scene appearances.

Maintain stable character IDs across the production.

Do not assume visual similarity alone proves identity.

## 7.5 Costume and Wardrobe Bible

Create a dedicated costume planning module.

For each character, document:

- Costume ID.
- Character ID.
- Scene association.
- Garment description.
- Fabric.
- Color.
- Pattern.
- Accessories.
- Footwear.
- Historical or cultural context where relevant.
- Visual references.
- Continuity requirements.

Support multiple costume versions.

This is especially important for period films and culturally specific productions.

Avoid inventing cultural details as facts. Allow human research and approval.

## 7.6 Location and Environment Bible

Document:

- Location ID.
- Scene association.
- Architectural characteristics.
- Environment description.
- Time of day.
- Weather.
- Lighting.
- Camera perspective.
- Set requirements.
- Visual references.
- Continuity requirements.

## 7.7 Props and Set Design

Create a structured props and set-design inventory.

Maintain relationships between:

- Props.
- Characters.
- Scenes.
- Locations.
- Costume requirements.

## 7.8 Storyboard Studio

Create storyboard functionality.

Each storyboard frame should contain:

- Frame ID.
- Scene ID.
- Shot number.
- Visual description.
- Characters.
- Location.
- Camera angle.
- Shot size.
- Camera movement.
- Lighting.
- Action.
- Dialogue or narration.
- Duration.
- Reference image.
- Generation prompt.
- Approval status.

Support AI-generated storyboard descriptions.

Prepare image-generation integration interfaces.

Allow storyboard images to be imported from ComfyUI or another configured image-generation provider.

## 7.9 Shot List and Cinematography Plan

Generate shot lists with:

- Scene number.
- Shot number.
- Shot size.
- Camera angle.
- Camera movement.
- Lens guidance where appropriate.
- Subject position.
- Composition.
- Lighting.
- Action.
- Estimated duration.
- Reference storyboard frame.

Allow the user or director to edit and approve each shot.

---

# 8. PRODUCTION DOCUMENT MANAGEMENT

Every major production document must be an editable project artifact.

Create a unified document management system.

Support:

- Document creation.
- Editing.
- Version history.
- Approval.
- Comments.
- Scene associations.
- Character associations.
- Export.

Provide export formats where technically supported:

- Markdown.
- PDF.
- DOCX.
- JSON.

Do not generate empty decorative document screens.

The documents must contain actual structured production information.

Maintain links between documents and their associated project entities.

When a character's costume changes, the application should be able to identify the affected scenes.

When a screenplay scene changes, the application should identify associated storyboards and shot lists that may require review.

---

# 9. MULTILINGUAL PRODUCTION AND TIGRIGNA SUPPORT

Extend the existing multilingual architecture.

Initial production languages:

- English.
- Amharic.
- Afaan Oromoo.
- Tigrigna.

The application must support Unicode correctly throughout:

- Project names.
- Screenplays.
- Dialogue.
- Narration.
- Character descriptions.
- Subtitles.
- Lyrics.
- Document exports.

Tigrigna support must not be treated as merely translating the interface.

Create language-aware production capabilities:

- Script translation.
- Dialogue localization.
- Narration localization.
- Subtitle generation.
- Language-specific text normalization.
- Text-to-speech provider compatibility.
- Speech-to-text provider compatibility.
- Human linguistic review.

Preserve the meaning and cultural context of the original material.

Do not claim a provider supports high-quality Tigrigna voice generation until it has been verified.

Allow different voice providers for different languages.

---

# 10. PRODUCTION INTELLIGENCE AND CONTINUITY

Create the foundation for a production-wide consistency engine.

The system should understand relationships between:

- Screenplay scenes.
- Characters.
- Costumes.
- Props.
- Locations.
- Storyboards.
- Shot lists.
- Prompts.
- Generated clips.

Each entity must have stable IDs.

Create dependency relationships.

Examples:

If a character's appearance changes, identify affected reference images and scenes.

If a costume changes, identify scenes using that costume.

If a scene's location changes, identify associated storyboards and prompts.

If a screenplay scene is modified, identify dependent production documents.

Do not automatically overwrite approved production assets.

Instead, create review notifications.

Implement a continuity dashboard that identifies:

- Potential character inconsistencies.
- Costume inconsistencies.
- Location inconsistencies.
- Unreviewed script changes.
- Missing storyboard frames.
- Missing production references.

Where automated detection is not yet available, implement structured manual review.

Clearly distinguish detected problems from manually reported problems.

---

# 11. MODEL CAPABILITY AND COST AWARENESS

Extend the model registry with cost awareness.

For each provider/model, support optional metadata:

- Free-tier availability.
- Paid API.
- Local/self-hosted.
- Estimated input cost.
- Estimated output cost.
- Estimated image-generation cost.
- Estimated video-generation cost.
- Currency.
- Last verified date.

Do not invent prices.

Prices must be user-configurable or obtained from a verified provider source.

Allow users to classify models as:

- Preferred quality.
- Balanced.
- Low-cost.
- Local/offline.
- Experimental.

Provide a production configuration that can prioritize:

1. Quality.
2. Cost.
3. Speed.
4. Local execution.

Do not claim that an open-source fallback is equivalent in quality to a commercial model.

---

# 12. AI PRODUCTION ASSISTANT

Create the architecture for an integrated AI Production Assistant.

The assistant should operate using project context.

It should be able to help users:

- Develop creative concepts.
- Write and revise screenplays.
- Generate production breakdowns.
- Create Character Bibles.
- Prepare costume descriptions.
- Prepare storyboard plans.
- Create shot lists.
- Generate scene prompts.
- Identify missing production information.
- Review continuity.
- Suggest production improvements.

Implement guided workflows.

The assistant must not automatically approve major production decisions.

Allow users to review and approve generated documents.

Do not expose confidential project data to external AI providers without the configured provider permissions and user consent.

Keep the assistant modular so that different models can handle different tasks.

---

# 13. USER EXPERIENCE

Extend the current application design.

Do not redesign everything.

Add a professional Production Development workspace.

Suggested navigation structure:

PRODUCTION
- Creative Development
- Screenplay Studio
- Production Breakdown
- Character Bible
- Costume Bible
- Location Bible
- Props and Set Design
- Storyboard Studio
- Shot List
- Production Documents
- Continuity Dashboard

AI INTELLIGENCE
- AI Providers
- Model Registry
- Model Routing
- Production Assistant
- Usage and Cost Tracking

The existing Generation Studio, Media Library, Timeline, ComfyUI integration, and Export Center must remain accessible.

The application should be responsive on desktop and tablet.

---

# 14. DATA ARCHITECTURE

Extend the existing portable project format without breaking old projects.

Introduce stable entities for:

- Production documents.
- Screenplay scenes.
- Characters.
- Character relationships.
- Costumes.
- Locations.
- Props.
- Storyboard frames.
- Shots.
- Provider configurations.
- Model configurations.
- Model routing policies.
- Production approvals.
- Continuity alerts.

Use schema versioning.

Create backward-compatible migrations.

Unknown metadata fields should be preserved when importing and exporting projects.

Never export API secrets.

Never include credentials in project ZIP files.

---

# 15. DEVELOPMENT PHASES

Implement this prompt incrementally.

PHASE A — AUDIT AND PROVIDER ARCHITECTURE

- Inspect existing AI integration.
- Build provider registry.
- Build model capability registry.
- Build secure provider settings.
- Make all external services optional.
- Verify existing Gemini integration.

PHASE B — PRODUCTION DEVELOPMENT FOUNDATION

- Creative brief.
- Logline.
- Synopsis.
- Treatment.
- Screenplay document foundation.
- Production document manager.

PHASE C — PRODUCTION BIBLES

- Character Bible improvements.
- Costume Bible.
- Location Bible.
- Props inventory.
- Scene breakdown.

PHASE D — STORYBOARD AND SHOT PLANNING

- Storyboard frame structure.
- Shot list.
- Cinematography planning.
- Links to existing scene planner.

PHASE E — MULTILINGUAL PRODUCTION

- Tigrigna project support.
- Script localization.
- Dialogue and narration management.
- Subtitle workflow.

PHASE F — PRODUCTION CONTINUITY

- Entity relationships.
- Change tracking.
- Continuity alerts.
- Approval workflow.

PHASE G — AI PRODUCTION ASSISTANT

- Project-aware assistant.
- Task-based model routing.
- Structured production document generation.
- Human approval workflow.

Do not implement all phases in one operation.

Complete and verify each phase.

---

# 16. DEVELOPMENT WITHOUT PAID INFRASTRUCTURE

The application must remain useful even if the user has no paid API keys or external GPU server.

Use these rules:

- Do not require OpenAI credentials.
- Do not require Anthropic credentials.
- Do not require a ComfyUI server.
- Do not require a Qwen endpoint.
- Do not require external rendering services if local FFmpeg is already available.
- Do not block application startup because a provider is unconfigured.

Use Offline Simulation Mode for isolated development tests.

Label simulated results clearly.

Allow manually authored production documents.

Allow users to configure providers later.

Do not silently use a mock response as though it came from a real model.

The user should be able to continue building and organizing a production even when external AI providers are unavailable.

---

# 17. QUALITY ASSURANCE

Test:

- Existing project loading.
- Existing project export/import.
- IndexedDB persistence.
- Provider registry.
- Provider settings.
- Secret protection.
- Model capability selection.
- Provider fallback behavior.
- Production document creation.
- Document editing.
- Version history.
- Character associations.
- Costume associations.
- Scene associations.
- Storyboard relationships.
- Tigrigna Unicode handling.
- ZIP export/import.
- Backward compatibility.

Run available build and type checks.

Do not claim tests passed unless actually executed.

Do not claim external AI generation is operational without a real provider test.

Document all blocked tests.

---

# 18. MULTI-ACCOUNT DEVELOPMENT CONTINUITY

Preserve the existing multi-account development system.

Update:

AGENTS.md

docs/development/PROJECT_STATE.md

docs/development/IMPLEMENTATION_ROADMAP.md

docs/development/CHANGELOG.md

docs/development/KNOWN_ISSUES.md

docs/development/TEST_REPORT.md

docs/development/DEVELOPMENT_LOG.md

docs/handoff/NEXT_ACCOUNT_START_HERE.md

docs/handoff/HANDOFF_MANIFEST.json

Create:

docs/architecture/AI_PROVIDER_ORCHESTRATION.md

docs/architecture/PRODUCTION_DATA_MODEL.md

docs/architecture/PRODUCTION_DOCUMENT_SYSTEM.md

docs/development/PRODUCTION_INTELLIGENCE_AUDIT.md

Record the actual state of implementation.

Do not remove historical development information.

---

# 19. FIRST EXECUTION INSTRUCTIONS

Start with the repository audit.

Then implement PHASE A.

After Phase A is verified, proceed to PHASE B if sufficient execution capacity remains.

Prioritize functional provider configuration and the production document foundation over decorative interfaces.

Do not ask the user to purchase API keys.

Do not ask the user to provide GPU server URLs.

Do not block development because external services are unavailable.

Use sensible defaults and clearly identify unavailable services.

When you reach a quota-related or handoff point, preserve the entire development state.

---

# FINAL PRODUCT VISION

Neural Symphony Studio must evolve into a professional AI-assisted production environment in which a creator can develop a complete film or advertisement from an initial concept.

It should coordinate specialized AI models, maintain production documents, preserve character and visual continuity, organize scenes and shots, generate images and videos, create multilingual audio and subtitles, and assemble the final production.

It must remain open to commercial AI providers, open-source models, self-hosted inference, and future generation technologies.

Build the foundation now.

Make the architecture extensible.

Preserve the existing application.

Develop incrementally.

Test honestly.

Keep every production decision connected to the actual project.

Do not confuse a visually impressive interface with a working production system.