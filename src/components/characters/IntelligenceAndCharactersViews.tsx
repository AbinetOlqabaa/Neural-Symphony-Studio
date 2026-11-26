import { useMemo, useState } from 'react';
import { Check, GitMerge, Plus, ScanSearch, Split, UserCheck } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import {
  evaluateCharacterMatch,
  mergeCharacters,
  splitCharacterAsset,
} from '../../modules/character-intelligence/characterMatcher';
import {
  normalizeCharacterEntry,
  revertCharacterToVersion,
  snapshotCharacterVersion,
} from '../../modules/production/preProductionEngine';
import type { CharacterCategory, ImageAnalysis, VisionProviderId } from '../../types/studio';
import { MediaThumb } from '../shared/MediaThumb';

export function ImageIntelligenceView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [provider, setProvider] = useState<VisionProviderId>('gemini');
  const [running, setRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [draftDescription, setDraftDescription] = useState<string | null>(null);
  const [draftTreatment, setDraftTreatment] = useState<string | null>(null);

  if (!project) return null;

  const asset = project.mediaAssets.find((a) => a.id === selectedAssetId) || project.mediaAssets[0];
  const analysis: ImageAnalysis | undefined = asset ? project.analyses[asset.id] : undefined;

  const matchCandidates = useMemo(() => {
    if (!analysis) return [];
    return evaluateCharacterMatch(analysis, project.characters);
  }, [analysis, project.characters]);

  const handleRunAnalysis = async () => {
    if (!asset) return;
    setRunning(true);
    setErrorMsg('');
    try {
      const res = await store.analyzeAsset(asset.id, provider);
      if (res) {
        setDraftDescription(res.description);
        setDraftTreatment(res.suggestedCinematicTreatment);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Analysis request failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleSaveManual = () => {
    if (!asset || !analysis) return;
    store.saveAnalysisCorrection(asset.id, {
      ...analysis,
      description: draftDescription ?? analysis.description,
      suggestedCinematicTreatment: draftTreatment ?? analysis.suggestedCinematicTreatment,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold">AI Image Intelligence</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Structured visual breakdown via Qwen2.5-VL-3B-Instruct (external endpoint) or server-side Gemini Vision.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="vision-provider-select" className="sr-only">
            Vision model provider
          </label>
          <select
            id="vision-provider-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value as VisionProviderId)}
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            <option value="gemini">Gemini Vision ({store.settings.geminiModel})</option>
            <option value="qwen-vl">Qwen2.5-VL-3B-Instruct (External Endpoint)</option>
          </select>
          <button
            type="button"
            disabled={!asset || running}
            onClick={() => void handleRunAnalysis()}
            className="h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] disabled:opacity-50 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <ScanSearch className="w-3.5 h-3.5" />
            <span>{running ? 'Analyzing...' : 'Analyze Selected Image'}</span>
          </button>
          {analysis && (
            <button
              type="button"
              disabled={!asset || running}
              onClick={async () => {
                if (!asset) return;
                setRunning(true);
                setErrorMsg('');
                try {
                  const res = await store.analyzeAsset(asset.id, provider, { forceRefresh: true });
                  if (res) {
                    setDraftDescription(res.description);
                    setDraftTreatment(res.suggestedCinematicTreatment);
                  }
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : 'Re-analysis request failed.');
                } finally {
                  setRunning(false);
                }
              }}
              className="h-9 px-3 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs font-medium disabled:opacity-50 whitespace-nowrap"
            >
              Re-Analyze
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-md border border-[var(--ns-danger)] bg-[var(--ns-danger)]/10 text-xs text-[var(--ns-danger)]">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Asset Selector */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-[var(--ns-text-muted)]">Project Media Assets</div>
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {project.mediaAssets.map((item) => {
                const isSelected = asset?.id === item.id;
                const hasAnalysis = Boolean(project.analyses[item.id]);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedAssetId(item.id);
                      setDraftDescription(null);
                      setDraftTreatment(null);
                    }}
                    className={`w-full flex items-center gap-3 p-2 rounded-md border text-left transition-colors ${
                      isSelected
                        ? 'border-[var(--ns-accent)] bg-[var(--ns-accent)]/10'
                        : 'border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)]'
                    }`}
                  >
                    <MediaThumb src={item.thumbnailUrl} alt={item.fileName} className="w-14 rounded shrink-0" aspectClass="aspect-square" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{item.fileName}</div>
                      <div className="text-[11px] text-[var(--ns-text-subtle)]">
                        {hasAnalysis ? 'Analyzed' : 'Not analyzed'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {asset && (
            <div className="bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-3 space-y-2">
              <MediaThumb src={asset.dataUrl} alt={asset.fileName} className="rounded" aspectClass="aspect-[4/3]" />
              <div className="text-xs text-[var(--ns-text-muted)] tabular-nums">
                {asset.width} x {asset.height} · {asset.category}
              </div>
            </div>
          )}
        </div>

        {/* Right Structured Breakdown */}
        <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-5">
          {!analysis ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-medium">No structured analysis recorded for this image yet.</p>
              <p className="text-xs text-[var(--ns-text-muted)]">
                Select a Vision provider above and click Analyze Selected Image to extract observable attributes.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
                <div className="text-xs text-[var(--ns-text-muted)]">
                  Provider: <span className="text-[var(--ns-text)] font-medium">{analysis.modelName}</span> · Confidence{' '}
                  <span className="font-mono tabular-nums">{Math.round((analysis.confidence || 0) * 100)}%</span>
                  {analysis.userEdited && ' · Manually Reviewed'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowJson((v) => !v)}
                    className="h-7 px-3 rounded border border-[var(--ns-border)] text-xs"
                  >
                    {showJson ? 'Visual Fields' : 'View JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveManual}
                    className="h-7 px-3 rounded bg-[var(--ns-accent)] text-white text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Save Corrections</span>
                  </button>
                </div>
              </div>

              {showJson ? (
                <pre className="p-4 rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs font-mono overflow-x-auto max-h-[520px]">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label htmlFor="intel-desc" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                      Observable Description
                    </label>
                    <textarea
                      id="intel-desc"
                      rows={2}
                      value={draftDescription ?? analysis.description}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      className="w-full p-2.5 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="intel-treatment" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                      Suggested Cinematic Treatment
                    </label>
                    <input
                      id="intel-treatment"
                      type="text"
                      value={draftTreatment ?? analysis.suggestedCinematicTreatment}
                      onChange={(e) => setDraftTreatment(e.target.value)}
                      className="w-full h-9 px-3 text-sm rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {[
                      ['Human Subjects', analysis.visualAttributes.humanSubjects],
                      ['Clothing', analysis.visualAttributes.clothing],
                      ['Hairstyle', analysis.visualAttributes.hairstyle],
                      ['Facial Characteristics', analysis.visualAttributes.facialCharacteristics],
                      ['Pose & Orientation', `${analysis.visualAttributes.pose} (${analysis.visualAttributes.bodyOrientation})`],
                      ['Environment', analysis.visualAttributes.environment],
                      ['Background', analysis.visualAttributes.background],
                      ['Lighting', analysis.visualAttributes.lighting],
                      ['Camera Perspective', analysis.visualAttributes.cameraPerspective],
                      ['Composition', analysis.visualAttributes.composition],
                      ['Visual Style', analysis.visualAttributes.visualStyle],
                      ['Emotional Expression', analysis.visualAttributes.emotionalExpression],
                      ['Colors', analysis.visualAttributes.colors.join(', ')],
                      ['Image Quality', analysis.visualAttributes.imageQuality],
                    ].map(([label, value]) => (
                      <div key={label} className="p-2.5 rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]">
                        <div className="text-[11px] text-[var(--ns-text-subtle)]">{label}</div>
                        <div className="mt-0.5 text-[var(--ns-text)]">{value || 'Not visible'}</div>
                      </div>
                    ))}
                  </div>

                  {matchCandidates.length > 0 && (
                    <div className="pt-3 border-t border-[var(--ns-border)] space-y-2">
                      <div className="text-xs font-medium">Character Bible Candidate Matches</div>
                      <div className="space-y-1.5">
                        {matchCandidates.map((cand) => (
                          <div
                            key={cand.characterId}
                            className="flex items-center justify-between p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] text-xs"
                          >
                            <div>
                              <span className="font-medium">{cand.characterName}</span> ·{' '}
                              <span className="font-mono tabular-nums">{Math.round(cand.score * 100)}% similarity</span>
                              {cand.requiresHumanReview && ' · Requires Human Review'}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const target = project.characters.find((c) => c.id === cand.characterId);
                                if (!target || !asset) return;
                                store.upsertCharacter({
                                  ...target,
                                  referenceAssetIds: Array.from(new Set([...target.referenceAssetIds, asset.id])),
                                  associatedAssetIds: Array.from(new Set([...target.associatedAssetIds, asset.id])),
                                  reviewedByHuman: true,
                                  needsHumanReview: false,
                                });
                                store.notify('success', `Linked ${asset.fileName} to ${target.name}`);
                              }}
                              className="h-7 px-3 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)]"
                            >
                              Link Asset
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type CharacterBibleTab = 'identity' | 'development' | 'visual' | 'references' | 'history';

export function CharactersView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [mergeTargetId, setMergeTargetId] = useState<string>('');
  const [newCharName, setNewCharName] = useState('');
  const [activeTab, setActiveTab] = useState<CharacterBibleTab>('identity');
  const [versionSummary, setVersionSummary] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<{
    description?: string;
    personality?: string;
    motivation?: string;
    characterArc?: string;
    identityPreservationInstructions?: string;
  } | null>(null);

  if (!project) return null;

  const rawSelected = project.characters.find((c) => c.id === selectedCharId) || project.characters[0];
  const selected = rawSelected ? normalizeCharacterEntry(rawSelected) : undefined;
  const routePreview = store.resolveTaskPreview('screenplay_development');

  const handleCreateChar = () => {
    const id = `char_${Date.now().toString(36)}`;
    const entry = normalizeCharacterEntry({
      id,
      name: newCharName.trim() || `Character ${project.characters.length + 1}`,
      label: 'Supporting Subject',
      characterCategory: 'supporting',
      referenceAssetIds: project.mediaAssets[0] ? [project.mediaAssets[0].id] : [],
      primaryReferenceAssetId: project.mediaAssets[0]?.id,
      distinguishingCharacteristics: 'Describe defining visual traits',
      facialDescription: '',
      hairstyle: '',
      clothing: '',
      accessories: '',
      approximateAgeCategory: 'Adult',
      typicalPose: '',
      appearanceConstraints: '',
      identityPreservationInstructions: '',
      associatedAssetIds: project.mediaAssets[0] ? [project.mediaAssets[0].id] : [],
      associatedSceneIds: [],
      matchConfidence: 1,
      needsHumanReview: false,
      reviewedByHuman: true,
      approved: false,
    });
    store.upsertCharacter(entry);
    setSelectedCharId(id);
    setNewCharName('');
    store.notify('success', `Added "${entry.name}" to Character Bible`);
  };

  const handleAiSuggestProfile = async () => {
    if (!selected) return;
    setAiBusy(true);
    try {
      const prompt = [
        `Draft non-destructive Character Bible suggestions for character "${selected.name}" (${selected.label}) in project "${project.name}".`,
        `Known traits: ${selected.distinguishingCharacteristics}. Clothing: ${selected.clothing}.`,
        `Return JSON with keys: description, personality, motivation, characterArc, identityPreservationInstructions.`,
      ].join('\n');
      const res = await store.runOrchestratedPrompt({
        taskType: 'screenplay_development',
        prompt,
        systemInstruction:
          'You are a film pre-production character bible supervisor. Return strict JSON with keys description, personality, motivation, characterArc, identityPreservationInstructions.',
        responseJson: true,
      });
      const cleaned = res.outputText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned) as Record<string, string>;
      setAiDraft({
        description: parsed.description,
        personality: parsed.personality,
        motivation: parsed.motivation,
        characterArc: parsed.characterArc,
        identityPreservationInstructions: parsed.identityPreservationInstructions,
      });
    } catch (err) {
      store.notify('error', err instanceof Error ? err.message : 'AI suggestion failed');
    } finally {
      setAiBusy(false);
    }
  };

  const toggleMultiAngleRef = (
    bucket: 'frontAssetIds' | 'sideProfileAssetIds' | 'fullBodyAssetIds' | 'expressionAssetIds',
    assetId: string
  ) => {
    if (!selected) return;
    const refs = selected.references!;
    const current = refs[bucket] || [];
    const nextBucket = current.includes(assetId)
      ? current.filter((id) => id !== assetId)
      : [...current, assetId];
    const nextRefAssets = Array.from(new Set([...selected.referenceAssetIds, assetId]));
    store.upsertCharacter({
      ...selected,
      referenceAssetIds: nextRefAssets,
      associatedAssetIds: Array.from(new Set([...selected.associatedAssetIds, assetId])),
      references: {
        ...refs,
        [bucket]: nextBucket,
      },
    });
  };

  const linkedCostumes = selected
    ? (project.costumes || []).filter((co) => co.characterId === selected.id)
    : [];
  const linkedScenes = selected
    ? project.scenes.filter((s) => s.characterIds.includes(selected.id))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Character Bible Studio</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Structured identity profiles, character arcs, visual consistency rules, multi-angle references, and version history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newCharName}
            onChange={(e) => setNewCharName(e.target.value)}
            placeholder="New character name..."
            aria-label="New character name"
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          />
          <button
            type="button"
            onClick={handleCreateChar}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Character</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Character List */}
        <div className="lg:col-span-4 space-y-2.5">
          {project.characters.length === 0 ? (
            <div className="p-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-xs text-[var(--ns-text-muted)]">
              No characters yet. Add your first character above or link subjects from Image Intelligence.
            </div>
          ) : (
            project.characters.map((rawChar) => {
              const char = normalizeCharacterEntry(rawChar);
              const primaryAsset = project.mediaAssets.find(
                (a) =>
                  a.id ===
                  (char.references?.approvedPortraitAssetId ||
                    char.primaryReferenceAssetId ||
                    char.referenceAssetIds[0])
              );
              const isSelected = selected?.id === char.id;
              return (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => {
                    setSelectedCharId(char.id);
                    setAiDraft(null);
                  }}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                    isSelected
                      ? 'border-[var(--ns-accent)] bg-[var(--ns-surface-elevated)]'
                      : 'border-[var(--ns-border)] bg-[var(--ns-surface)] hover:border-[var(--ns-border-strong)]'
                  }`}
                >
                  <MediaThumb
                    src={primaryAsset?.thumbnailUrl}
                    alt={char.name}
                    className="w-14 rounded shrink-0"
                    aspectClass="aspect-square"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{char.name}</span>
                      <span className="font-mono text-[11px] text-[var(--ns-text-subtle)] tabular-nums">
                        v{char.version || 1}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--ns-text-muted)] truncate">
                      {char.label} · {char.characterCategory || 'supporting'}
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)] mt-0.5 tabular-nums">
                      {char.referenceAssetIds.length} refs ·{' '}
                      {char.needsHumanReview ? 'Needs review' : char.approved ? 'Approved' : 'Draft'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Character Bible Editor */}
        <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-5">
          {!selected ? (
            <p className="text-xs text-[var(--ns-text-muted)]">
              Add or select a character to edit their Character Bible.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ns-border)] pb-3">
                <div>
                  <div className="text-xs font-mono text-[var(--ns-text-subtle)]">
                    {selected.id} · v{selected.version || 1} · {linkedScenes.length} scene(s) ·{' '}
                    {linkedCostumes.length} costume(s)
                  </div>
                  <h2 className="font-display text-lg font-semibold">{selected.name}</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={aiBusy || !routePreview.executable}
                    onClick={() => void handleAiSuggestProfile()}
                    title={routePreview.userNotice}
                    className="h-8 px-3 rounded border border-[var(--ns-border)] text-xs font-medium disabled:opacity-45 hover:bg-[var(--ns-surface-elevated)]"
                  >
                    {aiBusy ? 'Drafting...' : 'AI Draft Suggestions'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      store.upsertCharacter({
                        ...selected,
                        approved: !selected.approved,
                        reviewedByHuman: true,
                        needsHumanReview: false,
                      })
                    }
                    className={`h-8 px-3 rounded border text-xs font-medium inline-flex items-center gap-1.5 ${
                      selected.approved
                        ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                        : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{selected.approved ? 'Bible Approved' : 'Approve Bible'}</span>
                  </button>
                  {project.characters.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={mergeTargetId}
                        onChange={(e) => setMergeTargetId(e.target.value)}
                        aria-label="Merge into character"
                        className="h-8 px-2 text-xs rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      >
                        <option value="">Merge with...</option>
                        {project.characters
                          .filter((c) => c.id !== selected.id)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        disabled={!mergeTargetId}
                        onClick={() => {
                          if (!mergeTargetId) return;
                          store.replaceCharacters(mergeCharacters(project.characters, selected.id, mergeTargetId));
                          setMergeTargetId('');
                          store.notify('success', 'Merged character identities');
                        }}
                        className="h-8 px-2.5 rounded border border-[var(--ns-border)] disabled:opacity-40 text-xs inline-flex items-center gap-1"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>Merge</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {aiDraft && (
                <div className="p-3.5 rounded-md border border-[var(--ns-accent)] bg-[var(--ns-surface-inset)] space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">AI Character Suggestion Draft (Review Before Applying)</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          store.upsertCharacter({
                            ...selected,
                            description: aiDraft.description || selected.description,
                            identityPreservationInstructions:
                              aiDraft.identityPreservationInstructions || selected.identityPreservationInstructions,
                            development: {
                              ...selected.development!,
                              personality: aiDraft.personality || selected.development!.personality,
                              motivation: aiDraft.motivation || selected.development!.motivation,
                              characterArc: aiDraft.characterArc || selected.development!.characterArc,
                            },
                          });
                          setAiDraft(null);
                          store.notify('success', 'Applied reviewed AI suggestions to Character Bible');
                        }}
                        className="h-7 px-2.5 rounded bg-[var(--ns-accent)] text-white font-medium"
                      >
                        Apply Draft
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiDraft(null)}
                        className="h-7 px-2.5 rounded border border-[var(--ns-border)]"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                  {aiDraft.description && <p><strong>Description:</strong> {aiDraft.description}</p>}
                  {aiDraft.personality && <p><strong>Personality:</strong> {aiDraft.personality}</p>}
                  {aiDraft.motivation && <p><strong>Motivation:</strong> {aiDraft.motivation}</p>}
                  {aiDraft.characterArc && <p><strong>Arc:</strong> {aiDraft.characterArc}</p>}
                </div>
              )}

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-[var(--ns-border)] pb-2 text-xs">
                {(
                  [
                    ['identity', 'Identity'],
                    ['development', 'Development & Arc'],
                    ['visual', 'Visual Identity'],
                    ['references', 'References & Prompt'],
                    ['history', `Version History (${selected.versionHistory?.length || 0})`],
                  ] as Array<[CharacterBibleTab, string]>
                ).map(([tabId, label]) => (
                  <button
                    key={tabId}
                    type="button"
                    onClick={() => setActiveTab(tabId)}
                    className={`h-8 px-3 rounded-md font-medium transition-colors ${
                      activeTab === tabId
                        ? 'bg-[var(--ns-accent)]/15 text-[var(--ns-text)] border border-[var(--ns-accent)]/40'
                        : 'text-[var(--ns-text-muted)] hover:text-[var(--ns-text)] border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === 'identity' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Character Name</label>
                      <input
                        type="text"
                        value={selected.name}
                        onChange={(e) => store.upsertCharacter({ ...selected, name: e.target.value })}
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Alternative / Nicknames</label>
                      <input
                        type="text"
                        value={selected.alternativeNames || ''}
                        onChange={(e) => store.upsertCharacter({ ...selected, alternativeNames: e.target.value })}
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Category</label>
                      <select
                        value={selected.characterCategory || 'supporting'}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            characterCategory: e.target.value as CharacterCategory,
                          })
                        }
                        className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      >
                        <option value="lead">Lead</option>
                        <option value="supporting">Supporting</option>
                        <option value="ensemble">Ensemble</option>
                        <option value="narrator">Narrator</option>
                        <option value="historical">Historical Figure</option>
                        <option value="cameo">Cameo</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Role / Label</label>
                      <input
                        type="text"
                        value={selected.label}
                        onChange={(e) => store.upsertCharacter({ ...selected, label: e.target.value })}
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Age Range / Category</label>
                      <input
                        type="text"
                        value={selected.ageRange || selected.approximateAgeCategory}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            ageRange: e.target.value,
                            approximateAgeCategory: e.target.value,
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Gender / Presentation</label>
                      <input
                        type="text"
                        value={selected.gender || ''}
                        onChange={(e) => store.upsertCharacter({ ...selected, gender: e.target.value })}
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">Narrative Role & Character Summary</label>
                    <textarea
                      rows={3}
                      value={selected.description || ''}
                      onChange={(e) => store.upsertCharacter({ ...selected, description: e.target.value })}
                      className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>
                  <div className="pt-2 border-t border-[var(--ns-border)] flex items-center justify-between">
                    <div className="text-[11px] text-[var(--ns-text-muted)]">
                      Assigned Costumes: {linkedCostumes.map((c) => c.name || c.garmentDescription).join(', ') || 'None'}
                    </div>
                    {confirmDeleteId === selected.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--ns-danger)]">Delete character permanently?</span>
                        <button
                          type="button"
                          onClick={() => {
                            store.deleteCharacter(selected.id);
                            setConfirmDeleteId(null);
                          }}
                          className="h-7 px-2.5 rounded bg-[var(--ns-danger)] text-white"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-7 px-2.5 rounded border border-[var(--ns-border)]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(selected.id)}
                        className="h-7 px-3 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                      >
                        Delete Character
                      </button>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'development' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(
                    [
                      ['personality', 'Personality Traits'],
                      ['background', 'Backstory & Background'],
                      ['motivation', 'Core Motivation'],
                      ['goals', 'Goals'],
                      ['fears', 'Fears & Vulnerabilities'],
                      ['strengths', 'Strengths'],
                      ['weaknesses', 'Weaknesses'],
                      ['relationships', 'Key Relationships'],
                      ['characterArc', 'Character Arc'],
                      ['importantEvents', 'Defining Past Events'],
                    ] as const
                  ).map(([field, label]) => (
                    <div key={field} className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">{label}</label>
                      <textarea
                        rows={2}
                        value={selected.development?.[field] || ''}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            development: {
                              ...selected.development!,
                              [field]: e.target.value,
                            },
                          })
                        }
                        className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'visual' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(
                      [
                        ['facialDescription', 'Facial Description'],
                        ['hairstyle', 'Hairstyle'],
                        ['clothing', 'Default Clothing / Wardrobe'],
                        ['accessories', 'Accessories'],
                        ['typicalPose', 'Typical Posture / Pose'],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field} className="space-y-1">
                        <label className="block text-[var(--ns-text-muted)]">{label}</label>
                        <input
                          type="text"
                          value={selected[field]}
                          onChange={(e) => store.upsertCharacter({ ...selected, [field]: e.target.value })}
                          className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                        />
                      </div>
                    ))}
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Skin Tone & Complexion</label>
                      <input
                        type="text"
                        value={selected.visualIdentity?.skinTone || ''}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            visualIdentity: { ...selected.visualIdentity!, skinTone: e.target.value },
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Eyes & Expression</label>
                      <input
                        type="text"
                        value={selected.visualIdentity?.eyes || ''}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            visualIdentity: { ...selected.visualIdentity!, eyes: e.target.value },
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Body Proportions</label>
                      <input
                        type="text"
                        value={selected.visualIdentity?.bodyProportions || ''}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            visualIdentity: { ...selected.visualIdentity!, bodyProportions: e.target.value },
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[var(--ns-text-muted)]">Voice & Delivery Description</label>
                      <input
                        type="text"
                        value={selected.visualIdentity?.voiceDescription || ''}
                        onChange={(e) =>
                          store.upsertCharacter({
                            ...selected,
                            visualIdentity: { ...selected.visualIdentity!, voiceDescription: e.target.value },
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">Distinguishing Visual Characteristics</label>
                    <textarea
                      rows={2}
                      value={selected.distinguishingCharacteristics}
                      onChange={(e) =>
                        store.upsertCharacter({ ...selected, distinguishingCharacteristics: e.target.value })
                      }
                      className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">Identity Preservation Instructions</label>
                    <textarea
                      rows={2}
                      value={selected.identityPreservationInstructions}
                      onChange={(e) =>
                        store.upsertCharacter({ ...selected, identityPreservationInstructions: e.target.value })
                      }
                      className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'references' && (
                <div className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-[var(--ns-text-muted)]">
                      Dedicated Character Prompt Anchor (injected into Scene & Storyboard prompts)
                    </label>
                    <textarea
                      rows={2}
                      value={selected.references?.characterPrompt || ''}
                      onChange={(e) =>
                        store.upsertCharacter({
                          ...selected,
                          references: { ...selected.references!, characterPrompt: e.target.value },
                        })
                      }
                      className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                    />
                  </div>

                  <div className="text-[var(--ns-text-muted)] font-medium">
                    Multi-Angle Reference Matrix (Tag project media assets per angle)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {project.mediaAssets.map((asset) => {
                      const isPrimary = selected.primaryReferenceAssetId === asset.id;
                      const refs = selected.references!;
                      return (
                        <div
                          key={asset.id}
                          className="p-2.5 rounded-md border border-[var(--ns-border)] bg-[var(--ns-surface-inset)] flex gap-3"
                        >
                          <MediaThumb
                            src={asset.thumbnailUrl}
                            alt={asset.fileName}
                            className="w-16 rounded shrink-0"
                            aspectClass="aspect-square"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="font-medium truncate">{asset.fileName}</div>
                            <div className="flex flex-wrap gap-1.5 text-[11px]">
                              <button
                                type="button"
                                onClick={() =>
                                  store.upsertCharacter({
                                    ...selected,
                                    primaryReferenceAssetId: asset.id,
                                    referenceAssetIds: Array.from(new Set([...selected.referenceAssetIds, asset.id])),
                                    references: { ...refs, approvedPortraitAssetId: asset.id },
                                  })
                                }
                                className={`px-2 py-0.5 rounded border ${
                                  isPrimary
                                    ? 'border-[var(--ns-accent)] text-[var(--ns-accent)]'
                                    : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                                }`}
                              >
                                {isPrimary ? 'Approved Portrait' : 'Set Portrait'}
                              </button>
                              {(
                                [
                                  ['frontAssetIds', 'Front'],
                                  ['sideProfileAssetIds', 'Side'],
                                  ['fullBodyAssetIds', 'Full'],
                                  ['expressionAssetIds', 'Expr'],
                                ] as const
                              ).map(([bucket, label]) => {
                                const tagged = refs[bucket]?.includes(asset.id);
                                return (
                                  <button
                                    key={bucket}
                                    type="button"
                                    onClick={() => toggleMultiAngleRef(bucket, asset.id)}
                                    className={`px-1.5 py-0.5 rounded border ${
                                      tagged
                                        ? 'border-[var(--ns-accent-blue)] text-[var(--ns-accent-blue)]'
                                        : 'border-[var(--ns-border)] text-[var(--ns-text-subtle)]'
                                    }`}
                                  >
                                    {label}
                                  </button>
                                );
                              })}
                              {selected.referenceAssetIds.length > 1 &&
                                selected.referenceAssetIds.includes(asset.id) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      store.replaceCharacters(
                                        splitCharacterAsset(
                                          project.characters,
                                          selected.id,
                                          asset.id,
                                          `${selected.name} Split`
                                        )
                                      )
                                    }
                                    className="px-1.5 py-0.5 rounded border border-[var(--ns-border)] inline-flex items-center gap-0.5"
                                  >
                                    <Split className="w-3 h-3" />
                                    <span>Split</span>
                                  </button>
                                )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4 text-xs">
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={versionSummary}
                      onChange={(e) => setVersionSummary(e.target.value)}
                      placeholder="Snapshot note (e.g., Locked chorus wardrobe & hairstyle)..."
                      className="flex-1 h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const updated = snapshotCharacterVersion(selected, versionSummary);
                        store.upsertCharacter(updated);
                        setVersionSummary('');
                        store.notify('success', `Saved Character Bible v${updated.version}`);
                      }}
                      className="h-9 px-3.5 rounded bg-[var(--ns-accent)] text-white font-medium"
                    >
                      Save Version Snapshot
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(selected.versionHistory || []).length === 0 ? (
                      <p className="text-[var(--ns-text-muted)]">
                        No snapshots recorded yet. Save a version snapshot above before major visual revisions.
                      </p>
                    ) : (
                      (selected.versionHistory || [])
                        .slice()
                        .reverse()
                        .map((vh) => (
                          <div
                            key={vh.version}
                            className="p-3 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-inset)] flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-medium font-mono">
                                v{vh.version} · {vh.summary}
                              </div>
                              <div className="text-[11px] text-[var(--ns-text-subtle)]">
                                {vh.createdAt} · Clothing: {vh.snapshot.clothing || 'Unspecified'}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                store.upsertCharacter(revertCharacterToVersion(selected, vh.version));
                                store.notify('info', `Reverted ${selected.name} fields to v${vh.version}`);
                              }}
                              className="h-7 px-2.5 rounded border border-[var(--ns-border)] hover:bg-[var(--ns-surface-elevated)]"
                            >
                              Revert
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
