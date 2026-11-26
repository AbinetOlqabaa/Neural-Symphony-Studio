# Production Data Model & Schema Migration — Neural Symphony Studio

**Last Updated:** 2026-11-26  
**Current Schema Version:** `2.1.0` (`CURRENT_PROJECT_SCHEMA_VERSION` in `src/modules/persistence/projectMigration.ts`)

---

## 1. Backward-Compatible Schema Evolution

Version `2.1.0` preserves 100% of v1 and v2.0.0 entities untouched while upgrading Character Bible depth and adding `ProductionTask[]` for schedule planning:

| Entity / Property | Type (`src/types/studio.ts`) | Purpose |
| :--- | :--- | :--- |
| `schemaVersion` | `string` (`"2.1.0"`) | Tracks schema migration state on `Project`. |
| `characters` | `CharacterEntry[]` | Normalized with `characterCategory`, `development` (personality, motivation, arc, relationships), `visualIdentity`, `references` (front/side/full-body/expression tags), `approved`, and `versionHistory`. |
| `scenes` | `ScenePlan[]` | Extended with breakdown fields (`interiorExterior`, `timeOfDay`, `locationId`, `costumeIds`, `propIds`, `wardrobeRequirements`, `importantObjects`, `productionComplexity`) and `sourceScreenplayId/Version/Passage`. |
| `costumes` | `CostumeSpec[]` | Wardrobe specs linked to `characterId`, `sceneIds`, fabric/color/pattern/accessories/culturalContext, condition state, and `continuityNotes`. |
| `locations` | `LocationSpec[]` | `real_world | studio | fictional | ai_generated` settings, `INT/EXT`, lighting, weather, `sceneIds`, and `continuityNotes`. |
| `props` | `PropSpec[]` | `PropCategory`, character/location/scene links, narrative importance, and `sceneStates` progression across scenes. |
| `storyboardFrames` | `StoryboardFrameSpec[]` | Frame sequence per scene with `text_only | reference_image | ai_generated`, honest `generationStatus` (`planned | requested | generating | generated | failed`), and `shotId` link. |
| `shotList` | `ShotSpec[]` | Cinematography plan (`shotSize`, `cameraAngle`, `cameraMovement`, `focalLengthMm`, `depthOfField`, `lightingSetup`, `equipment`, `personnel`, `audioRequirements`, `priority`). |
| `productionTasks` | `ProductionTask[]` | Pre-Production / Production / Post-Production milestones (`startDate`, `endDate`, `priority`, `status`, `dependencyIds`, `sceneId`, `shotId`). |
| `continuityAlerts` | `ContinuityAlert[]` | Automated & manual findings with `classification` (`critical | warning | informational`), `affectedSection`, `intentionalDifference`, and `explanation`. |
| `extraMetadata` | `Record<string, unknown>` | Preserved across load, edit, and `.nss.zip` roundtrips. |

## 2. Migration & Sanitization Guarantees

- `migrateProjectSchema(rawProject)` safely upgrades v1 and v2.0.0 archives to `2.1.0` without losing scenes, media, documents, or `extraMetadata`.
- `sanitizeProjectForPortableExport(project)` strips secret-bearing keys before `.nss.zip` export (`costumes.json`, `locations.json`, `props.json`, `storyboard.json`, `shot_list.json`, `production_schedule.json`, `production_documents/*.md`, `media/*`).
