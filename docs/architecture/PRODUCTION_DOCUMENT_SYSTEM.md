# Unified Production Document System — Neural Symphony Studio

**Last Updated:** 2026-11-26  
**Pure Logic Module:** `src/modules/production/documentSystem.ts`  
**UI Surface:** `src/components/production/ProductionDevelopmentViews.tsx` (`CreativeDevelopmentView`, `ScreenplayStudioView`, `ProductionDocumentsView`, `ContinuityDashboardView`)

---

## 1. Document Lifecycle & Structure

Every pre-production deliverable—Creative Brief, Logline/Synopsis/Treatment, Screenplay Export, Character Bible, Costume Bible, Location Bible, Props List, Storyboard Plan, Shot List, and Production Notes—is represented uniformly as a `ProductionDocument`:

- **Identity & Classification**: `id`, `projectId`, `type` (`ProductionDocumentType`), `title`, `language` (`ProductionLanguage`), `format` (`'markdown' | 'json' | 'script_blocks'`).
- **Content & Governance**: `content` (Unicode NFC-safe string), `status` (`'draft' | 'in_review' | 'approved'`), `currentVersion` (monotonic integer), `aiGenerated` (boolean provenance flag), `approvedBy`, `approvedAt`.
- **Entity Cross-Links**: `linkedSceneIds[]`, `linkedCharacterIds[]`, `linkedScreenplaySceneIds[]`.
- **Audit Trail**:
  - `versions: ProductionDocumentVersion[]` — Immutable snapshots storing `version`, `timestamp`, `author`, `summary`, and full `content`.
  - `comments: ProductionDocumentComment[]` — Timestamped editorial review comments.

---

## 2. Safe Synchronization & Continuity Protection

1. **Human-in-the-Loop Sync**:
   - Editing the **Creative Brief** or **Screenplay Studio** lets creators click **Sync to Documents** / **Snapshot Revision**, creating a new versioned snapshot (`createDocumentVersion`) rather than silently destroying prior revisions.
   - AI-assisted drafts (`CreativeDevelopmentView` -> **Draft via Routed AI**) mark outputs with `aiGenerated: true` and enter `status: 'draft'` or `'in_review'`, never auto-approving major creative decisions.
2. **Non-Destructive Continuity Alerts (`src/modules/continuity/continuityEngine.ts`)**:
   - `analyzeProjectContinuity(project)` scans relationships across characters, reference images, screenplay scenes, linked Scene Planner cards, and approved Production Documents.
   - When an approved screenplay scene or character changes, dependent scenes and documents are flagged with `source: 'detected'` continuity alerts (`unreviewed_script_change`, `missing_reference`, `missing_storyboard`, `character_inconsistency`) without overwriting approved renders or documents.
   - Manually logged notes are kept visibly separate (`source: 'manual'`), and users can acknowledge/resolve alerts directly in **Continuity Dashboard**.

---

## 3. Multi-Format Portable Exports

All export functions in `src/modules/production/documentSystem.ts` preserve full UTF-8 Unicode (English, Amharic `አማርኛ`, Tigrigna `ትግርኛ`, Afaan Oromoo):

| Export Helper | Format | Details |
| :--- | :--- | :--- |
| `exportDocumentAsMarkdown` | `.md` | Includes YAML-style metadata header (`Status`, `Language`, `Version`, `AI Generated`), body content, and review comments. |
| `exportDocumentAsJson` | `.json` | Serializes full structured `ProductionDocument` excluding any secret keys. |
| `exportDocumentAsPrintableHtml` | `.html` (Print/PDF) | Escapes all raw HTML characters (`escapeHtml`) to prevent XSS and formats clean typographic print stylesheet (`window.print()` ready). |
| `exportDocumentAsWordDoc` | `.doc` (Word HTML) | Prepends UTF-8 BOM (`\uFEFF`) + escaped HTML Word XML namespaces so Microsoft Word / LibreOffice open Ge'ez script (`አማርኛ` / `ትግርኛ`) cleanly without mojibake. |
| `.nss.zip` Archive | `.zip` (`projectArchive.ts`) | Embeds `creative_brief.json`, `screenplay.json`, and `production_documents/*.md` alongside v1 media, workflows, and lyrics. |
