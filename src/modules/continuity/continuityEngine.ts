import type { ContinuityAlert, NavSection, Project } from '../../types/studio';

export interface ChangeImpactReport {
  sourceType: 'character' | 'screenplay' | 'costume' | 'location';
  sourceId: string;
  affectedSceneIds: string[];
  affectedDocumentIds: string[];
  affectedPromptIds: string[];
  affectedClipIds: string[];
  summary: string;
}

export function normalizeAlertClassification(
  severity: ContinuityAlert['severity']
): 'informational' | 'warning' | 'critical' {
  if (severity === 'action_required') return 'critical';
  if (severity === 'info') return 'informational';
  return 'warning';
}

export function analyzeCharacterImpact(project: Project, characterId: string): ChangeImpactReport {
  const affectedSceneIds = project.scenes
    .filter((s) => s.characterIds.includes(characterId))
    .map((s) => s.id);
  const affectedDocumentIds = (project.productionDocuments || [])
    .filter(
      (d) =>
        d.linkedCharacterIds.includes(characterId) ||
        d.linkedSceneIds.some((sid) => affectedSceneIds.includes(sid))
    )
    .map((d) => d.id);
  const affectedPromptIds = project.promptHistory
    .filter((p) => affectedSceneIds.includes(p.sceneId))
    .map((p) => p.id);
  const affectedClipIds = project.clips
    .filter((c) => affectedSceneIds.includes(c.sceneId))
    .map((c) => c.id);

  return {
    sourceType: 'character',
    sourceId: characterId,
    affectedSceneIds,
    affectedDocumentIds,
    affectedPromptIds,
    affectedClipIds,
    summary: `Impacts ${affectedSceneIds.length} scene(s), ${affectedDocumentIds.length} document(s), ${affectedPromptIds.length} prompt version(s), and ${affectedClipIds.length} clip(s). Approved assets are preserved until manually reviewed.`,
  };
}

export function analyzeScreenplayImpact(project: Project, screenplaySectionId: string): ChangeImpactReport {
  const section = (project.screenplay || []).find((s) => s.id === screenplaySectionId);
  const linkedSceneId = section?.linkedSceneId;
  const affectedSceneIds = linkedSceneId ? [linkedSceneId] : [];
  const affectedDocumentIds = (project.productionDocuments || [])
    .filter(
      (d) =>
        d.type === 'screenplay' ||
        d.type === 'breakdown' ||
        (linkedSceneId ? d.linkedSceneIds.includes(linkedSceneId) : false)
    )
    .map((d) => d.id);
  const affectedPromptIds = linkedSceneId
    ? project.promptHistory.filter((p) => p.sceneId === linkedSceneId).map((p) => p.id)
    : [];
  const affectedClipIds = linkedSceneId
    ? project.clips.filter((c) => c.sceneId === linkedSceneId).map((c) => c.id)
    : [];

  return {
    sourceType: 'screenplay',
    sourceId: screenplaySectionId,
    affectedSceneIds,
    affectedDocumentIds,
    affectedPromptIds,
    affectedClipIds,
    summary: linkedSceneId
      ? `Linked to scene ${linkedSceneId}; ${affectedPromptIds.length} prompt(s) and ${affectedClipIds.length} clip(s) may require review.`
      : 'Screenplay section is not linked to a Scene Planner beat yet.',
  };
}

export function analyzeProjectContinuity(project: Project): ContinuityAlert[] {
  const existingMap = new Map<string, ContinuityAlert>();
  for (const existing of project.continuityAlerts || []) {
    existingMap.set(existing.id, existing);
  }

  const now = new Date().toISOString();
  const detected: ContinuityAlert[] = [];

  const charIds = new Set(project.characters.map((c) => c.id));
  const sceneIds = new Set(project.scenes.map((s) => s.id));
  const locationIds = new Set((project.locations || []).map((l) => l.id));
  const frameIds = new Set((project.storyboardFrames || []).map((f) => f.id));

  const registerAlert = (
    alert: Omit<ContinuityAlert, 'createdAt' | 'resolved' | 'classification'> & {
      affectedSection?: NavSection;
    }
  ) => {
    const prev = existingMap.get(alert.id);
    detected.push({
      ...alert,
      classification: normalizeAlertClassification(alert.severity),
      createdAt: prev?.createdAt || now,
      resolved: prev?.resolved || false,
      intentionalDifference: prev?.intentionalDifference || false,
      explanation: prev?.explanation,
    });
  };

  // 1. Character Bible checks: pending human review, missing references, unapproved visual mismatch risk
  for (const char of project.characters) {
    if (char.needsHumanReview && !char.reviewedByHuman) {
      registerAlert({
        id: `cont_char_review_${char.id}`,
        severity: 'warning',
        category: 'character',
        source: 'detected',
        title: `Character "${char.name}" pending human identity review`,
        description:
          'Automated face/wardrobe heuristic flagged potential ambiguity. Verify references in Character Bible before live rendering.',
        affectedEntityIds: [char.id, ...char.associatedSceneIds],
        affectedSection: 'characters',
      });
    }
    if (char.referenceAssetIds.length === 0) {
      registerAlert({
        id: `cont_char_ref_${char.id}`,
        severity: 'action_required',
        category: 'reference',
        source: 'detected',
        title: `Character "${char.name}" has no reference image`,
        description:
          'Attach at least one character reference still to enforce image-to-video identity preservation.',
        affectedEntityIds: [char.id],
        affectedSection: 'characters',
      });
    }
    if (
      char.approved &&
      char.visualIdentity?.defaultClothingStyle &&
      char.clothing &&
      char.visualIdentity.defaultClothingStyle.trim().toLowerCase() !== char.clothing.trim().toLowerCase()
    ) {
      registerAlert({
        id: `cont_char_appearance_mismatch_${char.id}`,
        severity: 'warning',
        category: 'character',
        source: 'detected',
        title: `Character "${char.name}" appearance notes differ from approved clothing baseline`,
        description: `Approved default style ("${char.visualIdentity.defaultClothingStyle}") differs from current Character Bible clothing ("${char.clothing}"). Review or mark intentional.`,
        affectedEntityIds: [char.id],
        affectedSection: 'characters',
      });
    }
  }

  // 2. Scene breakdown, missing characters, missing costumes, missing locations, and storyboard coverage
  const orderedScenes = project.scenes.slice().sort((a, b) => a.order - b.order);
  for (let i = 0; i < orderedScenes.length; i++) {
    const scene = orderedScenes[i];

    if (scene.referenceAssetIds.length === 0) {
      registerAlert({
        id: `cont_scene_ref_${scene.id}`,
        severity: 'action_required',
        category: 'reference',
        source: 'detected',
        title: `Scene "${scene.title}" has no starting reference frame`,
        description: 'Image-to-video adapters (LTX-Video 0.9.5 & Wan 2.1) require a primary reference frame.',
        affectedEntityIds: [scene.id],
        affectedSection: 'scenes',
      });
    }

    // Scene referencing missing character profile
    for (const cid of scene.characterIds) {
      if (!charIds.has(cid)) {
        registerAlert({
          id: `cont_scene_missing_char_${scene.id}_${cid}`,
          severity: 'action_required',
          category: 'character',
          source: 'detected',
          title: `Scene "${scene.title}" references missing Character ID "${cid}"`,
          description: 'Assign an existing Character Bible profile or clean up the stale character link.',
          affectedEntityIds: [scene.id, cid],
          affectedSection: 'breakdown',
        });
      } else {
        // Character in scene without costume defined (when project tracks costumes)
        const hasCostumeForCharInScene = (project.costumes || []).some(
          (co) =>
            co.characterId === cid &&
            (co.sceneIds.includes(scene.id) || (scene.costumeIds || []).includes(co.id))
        );
        if (!hasCostumeForCharInScene) {
          const charName = project.characters.find((c) => c.id === cid)?.name || cid;
          registerAlert({
            id: `cont_costume_missing_${scene.id}_${cid}`,
            severity: 'warning',
            category: 'costume',
            source: 'detected',
            title: `Undefined costume for "${charName}" in "${scene.title}"`,
            description: `Link a Costume Bible entry to "${charName}" for this scene or mark intentional if character relies on default look.`,
            affectedEntityIds: [scene.id, cid],
            affectedSection: 'costumes',
          });
        }
      }
    }

    // Scene referencing deleted/missing Location
    if (scene.locationId && !locationIds.has(scene.locationId)) {
      registerAlert({
        id: `cont_scene_missing_loc_${scene.id}`,
        severity: 'action_required',
        category: 'location',
        source: 'detected',
        title: `Scene "${scene.title}" references deleted Location "${scene.locationId}"`,
        description: 'Re-link this scene to an active Location Bible entry in Scene Breakdown.',
        affectedEntityIds: [scene.id, scene.locationId],
        affectedSection: 'breakdown',
      });
    } else if (!scene.locationId && (project.locations || []).length > 0) {
      registerAlert({
        id: `cont_scene_unlinked_loc_${scene.id}`,
        severity: 'info',
        category: 'location',
        source: 'detected',
        title: `Scene "${scene.title}" has no formal Location Bible link`,
        description: 'Associate a Location Bible profile in Scene Breakdown for architectural and lighting continuity.',
        affectedEntityIds: [scene.id],
        affectedSection: 'locations',
      });
    }

    // Connected scenes with consecutive different locations or time-of-day shift notice
    if (i > 0) {
      const prevScene = orderedScenes[i - 1];
      if (
        prevScene.locationId &&
        scene.locationId &&
        prevScene.locationId === scene.locationId &&
        prevScene.timeOfDay &&
        scene.timeOfDay &&
        prevScene.timeOfDay.toLowerCase() !== scene.timeOfDay.toLowerCase()
      ) {
        registerAlert({
          id: `cont_loc_time_shift_${prevScene.id}_${scene.id}`,
          severity: 'warning',
          category: 'location',
          source: 'detected',
          title: `Time-of-day lighting shift at shared location between "${prevScene.title}" and "${scene.title}"`,
          description: `Connected scenes share location but shift from "${prevScene.timeOfDay}" to "${scene.timeOfDay}". Verify lighting continuity or mark intentional transition.`,
          affectedEntityIds: [prevScene.id, scene.id, scene.locationId],
          affectedSection: 'locations',
        });
      }
    }

    if ((project.storyboardFrames || []).filter((f) => f.sceneId === scene.id).length === 0) {
      registerAlert({
        id: `cont_scene_storyboard_${scene.id}`,
        severity: 'info',
        category: 'storyboard',
        source: 'detected',
        title: `Scene "${scene.title}" has no storyboard frames yet`,
        description: 'Add storyboard frames in Storyboard Studio or continue tracking via Scene Planner.',
        affectedEntityIds: [scene.id],
        affectedSection: 'storyboard',
      });
    }
  }

  // 3. Costume continuity across scenes for the same character
  for (const char of project.characters) {
    const charCostumes = (project.costumes || []).filter((co) => co.characterId === char.id);
    if (charCostumes.length > 1) {
      const unapprovedChanges = charCostumes.filter((co) => !co.intentionalChangeNotes?.trim());
      if (unapprovedChanges.length > 1) {
        registerAlert({
          id: `cont_costume_change_${char.id}`,
          severity: 'warning',
          category: 'costume',
          source: 'detected',
          title: `Multiple outfits assigned to "${char.name}" (${charCostumes.length} costumes)`,
          description:
            'Verify wardrobe transitions across scenes and document intentional changes in Costume Bible.',
          affectedEntityIds: [char.id, ...charCostumes.map((c) => c.id)],
          affectedSection: 'costumes',
        });
      }
    }
  }

  // 4. Props & Set Design state progression / missing location check
  for (const prop of project.props || []) {
    if (prop.locationId && !locationIds.has(prop.locationId)) {
      registerAlert({
        id: `cont_prop_missing_loc_${prop.id}`,
        severity: 'warning',
        category: 'props',
        source: 'detected',
        title: `Prop "${prop.name}" links to missing location "${prop.locationId}"`,
        description: 'Update primary location link in Props & Set Design Studio.',
        affectedEntityIds: [prop.id, prop.locationId],
        affectedSection: 'props',
      });
    }
    const states = prop.sceneStates || [];
    if (states.length > 1) {
      const distinctLabels = Array.from(new Set(states.map((s) => s.stateLabel.trim().toLowerCase())));
      if (distinctLabels.length > 1) {
        registerAlert({
          id: `cont_prop_state_${prop.id}`,
          severity: 'info',
          category: 'props',
          source: 'detected',
          title: `Prop "${prop.name}" changes condition across scenes (${states.map((s) => s.stateLabel).join(' -> ')})`,
          description: 'Confirm state progression matches script continuity or mark intentional.',
          affectedEntityIds: [prop.id, ...states.map((s) => s.sceneId)],
          affectedSection: 'props',
        });
      }
    }
  }

  // 5. Storyboard frames referencing missing scenes
  for (const frame of project.storyboardFrames || []) {
    if (!sceneIds.has(frame.sceneId)) {
      registerAlert({
        id: `cont_sb_missing_scene_${frame.id}`,
        severity: 'action_required',
        category: 'storyboard',
        source: 'detected',
        title: `Storyboard frame "${frame.shotNumber}" references missing scene "${frame.sceneId}"`,
        description: 'Re-assign this storyboard frame to an existing scene in Storyboard Studio.',
        affectedEntityIds: [frame.id, frame.sceneId],
        affectedSection: 'storyboard',
      });
    }
  }

  // 6. Shot list referencing missing storyboard frames or missing scenes
  for (const shot of project.shotList || []) {
    if (!sceneIds.has(shot.sceneId)) {
      registerAlert({
        id: `cont_shot_missing_scene_${shot.id}`,
        severity: 'action_required',
        category: 'shots',
        source: 'detected',
        title: `Shot "${shot.shotNumber}" references missing scene "${shot.sceneId}"`,
        description: 'Re-link shot to an active scene in Shot List Planner.',
        affectedEntityIds: [shot.id, shot.sceneId],
        affectedSection: 'shots',
      });
    }
    if (shot.storyboardFrameId && !frameIds.has(shot.storyboardFrameId)) {
      registerAlert({
        id: `cont_shot_missing_sb_${shot.id}`,
        severity: 'action_required',
        category: 'shots',
        source: 'detected',
        title: `Shot "${shot.shotNumber}" references deleted storyboard frame "${shot.storyboardFrameId}"`,
        description: 'Re-link shot to a current storyboard frame or clear the broken reference in Shot List Planner.',
        affectedEntityIds: [shot.id, shot.storyboardFrameId],
        affectedSection: 'shots',
      });
    }
  }

  // 7. Unreviewed screenplay edits affecting linked scenes or approved clips
  for (const scr of project.screenplay || []) {
    if (!scr.linkedSceneId) {
      registerAlert({
        id: `cont_scr_unlinked_${scr.id}`,
        severity: 'warning',
        category: 'screenplay',
        source: 'detected',
        title: `Screenplay section "${scr.slugline}" is unlinked`,
        description: 'Link this screenplay section to a Scene Planner beat so changes remain traceable.',
        affectedEntityIds: [scr.id],
        affectedSection: 'screenplay',
      });
      continue;
    }

    const linkedScene = project.scenes.find((s) => s.id === scr.linkedSceneId);
    if (!linkedScene) continue;

    if (!scr.approved && linkedScene.approvedForGeneration) {
      registerAlert({
        id: `cont_scr_unreviewed_${scr.id}`,
        severity: 'action_required',
        category: 'screenplay',
        source: 'detected',
        title: `Unreviewed screenplay edit on "${scr.slugline}"`,
        description: `Linked scene "${linkedScene.title}" is already approved for generation. Review script revision v${scr.revision} and update prompts/clips if needed.`,
        affectedEntityIds: [scr.id, linkedScene.id],
        affectedSection: 'screenplay',
      });
    }
  }

  // 8. Preserve all manual human-reported alerts untouched
  const manualAlerts = (project.continuityAlerts || [])
    .filter((a) => a.source === 'manual')
    .map((a) => ({
      ...a,
      classification: a.classification || normalizeAlertClassification(a.severity),
    }));
  return [...manualAlerts, ...detected];
}
