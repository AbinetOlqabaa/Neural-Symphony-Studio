import { useState } from 'react';
import { CheckCircle2, MapPin, Package, Plus, Shirt, Trash2 } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import type {
  CostumeSpec,
  InteriorExterior,
  LocationSpec,
  LocationType,
  PropCategory,
  PropSpec,
} from '../../types/studio';
import { MediaThumb } from '../shared/MediaThumb';

export function CostumeBibleView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!project) return null;
  const costumes = project.costumes || [];
  const selected = costumes.find((c) => c.id === selectedId) || costumes[0];

  const handleCreate = () => {
    const id = `cost_${Date.now().toString(36)}`;
    const firstChar = project.characters[0]?.id || '';
    const item: CostumeSpec = {
      id,
      name: newName.trim() || `Wardrobe Look ${costumes.length + 1}`,
      characterId: firstChar,
      sceneIds: project.scenes[0] ? [project.scenes[0].id] : [],
      storyTimeline: 'Scene Sequence',
      narrativePurpose: '',
      garmentDescription: 'Describe main garments, layering, and silhouette',
      garmentComponents: '',
      fabric: '',
      color: '',
      pattern: '',
      accessories: '',
      footwear: '',
      weatherSuitability: '',
      culturalContext: '',
      conditionState: 'Clean / Intact',
      referenceAssetIds: [],
      generationPrompt: '',
      continuityNotes: '',
      intentionalChangeNotes: '',
      approved: false,
      updatedAt: new Date().toISOString(),
    };
    store.upsertCostume(item);
    setSelectedId(id);
    setNewName('');
    store.notify('success', `Added "${item.name}" to Costume Bible`);
  };

  const toggleScene = (sceneId: string) => {
    if (!selected) return;
    const exists = selected.sceneIds.includes(sceneId);
    store.upsertCostume({
      ...selected,
      sceneIds: exists ? selected.sceneIds.filter((s) => s !== sceneId) : [...selected.sceneIds, sceneId],
      updatedAt: new Date().toISOString(),
    });
  };

  const toggleAsset = (assetId: string) => {
    if (!selected) return;
    const refs = selected.referenceAssetIds || [];
    const exists = refs.includes(assetId);
    store.upsertCostume({
      ...selected,
      referenceAssetIds: exists ? refs.filter((a) => a !== assetId) : [...refs, assetId],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Costume & Wardrobe Bible</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Define character outfits across scenes, cultural & weather context, condition states, and intentional wardrobe transitions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New outfit / look name..."
            aria-label="New outfit name"
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Costume</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        <div className="lg:col-span-4 space-y-2">
          {costumes.length === 0 ? (
            <div className="p-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-text-muted)]">
              No wardrobe looks created yet. Add your first costume above.
            </div>
          ) : (
            costumes.map((costume) => {
              const char = project.characters.find((c) => c.id === costume.characterId);
              const thumb = project.mediaAssets.find((a) => a.id === costume.referenceAssetIds?.[0]);
              const isSel = selected?.id === costume.id;
              return (
                <button
                  key={costume.id}
                  type="button"
                  onClick={() => setSelectedId(costume.id)}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                    isSel
                      ? 'border-[var(--ns-accent)] bg-[var(--ns-surface-elevated)]'
                      : 'border-[var(--ns-border)] bg-[var(--ns-surface)] hover:border-[var(--ns-border-strong)]'
                  }`}
                >
                  <MediaThumb
                    src={thumb?.thumbnailUrl}
                    alt={costume.name || costume.garmentDescription}
                    className="w-12 rounded shrink-0"
                    aspectClass="aspect-square"
                  />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold truncate flex items-center gap-1.5">
                      <Shirt className="w-3.5 h-3.5 text-[var(--ns-text-subtle)] shrink-0" />
                      <span className="truncate">{costume.name || costume.garmentDescription}</span>
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-muted)] truncate">
                      {char ? char.name : 'Unassigned character'} · {costume.sceneIds.length} scene(s)
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)]">
                      {costume.approved ? 'Approved' : 'Draft'} · {costume.color || 'Color unset'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
          {!selected ? (
            <p className="text-[var(--ns-text-muted)]">Select or create a costume to edit wardrobe specifications.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
                <div>
                  <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">{selected.id}</div>
                  <h2 className="font-display text-base font-semibold">
                    {selected.name || selected.garmentDescription}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.upsertCostume({ ...selected, approved: !selected.approved })}
                    className={`h-8 px-3 rounded border font-medium inline-flex items-center gap-1.5 ${
                      selected.approved
                        ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                        : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selected.approved ? 'Wardrobe Approved' : 'Approve Look'}</span>
                  </button>
                  {confirmDeleteId === selected.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          store.deleteCostume(selected.id);
                          setConfirmDeleteId(null);
                        }}
                        className="h-8 px-2.5 rounded bg-[var(--ns-danger)] text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-8 px-2.5 rounded border border-[var(--ns-border)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete costume ${selected.name || selected.id}`}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="h-8 px-2.5 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Look / Costume Name</label>
                  <input
                    type="text"
                    value={selected.name || ''}
                    onChange={(e) => store.upsertCostume({ ...selected, name: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Assigned Character</label>
                  <select
                    value={selected.characterId}
                    onChange={(e) => store.upsertCostume({ ...selected, characterId: e.target.value })}
                    className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="">Unassigned</option>
                    {project.characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.label})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Story Timeline / Sequence</label>
                  <input
                    type="text"
                    value={selected.storyTimeline || ''}
                    onChange={(e) => store.upsertCostume({ ...selected, storyTimeline: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Narrative Purpose</label>
                  <input
                    type="text"
                    value={selected.narrativePurpose || ''}
                    onChange={(e) => store.upsertCostume({ ...selected, narrativePurpose: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Primary Colors</label>
                  <input
                    type="text"
                    value={selected.color}
                    onChange={(e) => store.upsertCostume({ ...selected, color: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Fabric & Materials</label>
                  <input
                    type="text"
                    value={selected.fabric}
                    onChange={(e) => store.upsertCostume({ ...selected, fabric: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Pattern & Texture</label>
                  <input
                    type="text"
                    value={selected.pattern}
                    onChange={(e) => store.upsertCostume({ ...selected, pattern: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Footwear</label>
                  <input
                    type="text"
                    value={selected.footwear}
                    onChange={(e) => store.upsertCostume({ ...selected, footwear: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Accessories</label>
                  <input
                    type="text"
                    value={selected.accessories}
                    onChange={(e) => store.upsertCostume({ ...selected, accessories: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Weather / Climate Suitability</label>
                  <input
                    type="text"
                    value={selected.weatherSuitability || ''}
                    onChange={(e) => store.upsertCostume({ ...selected, weatherSuitability: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Cultural / Historical Context</label>
                  <input
                    type="text"
                    value={selected.culturalContext}
                    onChange={(e) => store.upsertCostume({ ...selected, culturalContext: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Condition State (Clean / Weathered / Wet)</label>
                  <input
                    type="text"
                    value={selected.conditionState || ''}
                    onChange={(e) => store.upsertCostume({ ...selected, conditionState: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Garment Description & Components</label>
                <textarea
                  rows={2}
                  value={selected.garmentDescription}
                  onChange={(e) => store.upsertCostume({ ...selected, garmentDescription: e.target.value })}
                  className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Continuity Rules</label>
                  <textarea
                    rows={2}
                    value={selected.continuityNotes}
                    onChange={(e) => store.upsertCostume({ ...selected, continuityNotes: e.target.value })}
                    className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">
                    Intentional Wardrobe Change Approval Note
                  </label>
                  <textarea
                    rows={2}
                    value={selected.intentionalChangeNotes || ''}
                    onChange={(e) => store.upsertCostume({ ...selected, intentionalChangeNotes: e.target.value })}
                    placeholder="Document intentional outfit switches between scenes..."
                    className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Wardrobe Generation Prompt</label>
                <input
                  type="text"
                  value={selected.generationPrompt || ''}
                  onChange={(e) => store.upsertCostume({ ...selected, generationPrompt: e.target.value })}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--ns-border)]">
                <div className="text-[var(--ns-text-muted)] font-medium">Scene Associations</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {project.scenes.map((sc) => {
                    const checked = selected.sceneIds.includes(sc.id);
                    return (
                      <label
                        key={sc.id}
                        className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      >
                        <input type="checkbox" checked={checked} onChange={() => toggleScene(sc.id)} />
                        <span className="truncate">{sc.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {project.mediaAssets.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[var(--ns-border)]">
                  <div className="text-[var(--ns-text-muted)] font-medium">Reference Images</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {project.mediaAssets.map((asset) => {
                      const linked = selected.referenceAssetIds?.includes(asset.id);
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => toggleAsset(asset.id)}
                          className={`p-1.5 rounded border text-left ${
                            linked
                              ? 'border-[var(--ns-accent)] bg-[var(--ns-accent)]/10'
                              : 'border-[var(--ns-border)] bg-[var(--ns-surface-inset)]'
                          }`}
                        >
                          <MediaThumb src={asset.thumbnailUrl} alt={asset.fileName} aspectClass="aspect-video" />
                          <div className="text-[11px] truncate mt-1">{asset.fileName}</div>
                        </button>
                      );
                    })}
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

export function LocationBibleView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!project) return null;
  const locations = project.locations || [];
  const selected = locations.find((l) => l.id === selectedId) || locations[0];

  const handleCreate = () => {
    const id = `loc_${Date.now().toString(36)}`;
    const item: LocationSpec = {
      id,
      name: newName.trim() || `Location ${locations.length + 1}`,
      sceneIds: [],
      locationType: 'real_world',
      geographicInfo: '',
      interiorExterior: 'EXT',
      dayNightSuitability: 'Dusk / Night',
      architecturalStyle: '',
      environmentDescription: 'Describe environment layout, horizon, and texture',
      timeOfDay: 'Dusk',
      weather: 'Clear',
      environmentalConditions: '',
      lighting: '',
      visualFeatures: '',
      referenceAssetIds: [],
      environmentPrompt: '',
      continuityNotes: '',
      approved: false,
      updatedAt: new Date().toISOString(),
    };
    store.upsertLocation(item);
    setSelectedId(id);
    setNewName('');
    store.notify('success', `Added "${item.name}" to Location Bible`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Location Bible</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Catalog real-world, studio, fictional, and AI-designed sets with lighting, weather, INT/EXT, and multi-scene continuity rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New location name..."
            aria-label="New location name"
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Location</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        <div className="lg:col-span-4 space-y-2">
          {locations.length === 0 ? (
            <div className="p-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-text-muted)]">
              No locations cataloged yet. Create one above.
            </div>
          ) : (
            locations.map((loc) => {
              const thumb = project.mediaAssets.find((a) => a.id === loc.referenceAssetIds?.[0]);
              const isSel = selected?.id === loc.id;
              const linkedCount = project.scenes.filter(
                (s) => s.locationId === loc.id || loc.sceneIds.includes(s.id)
              ).length;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedId(loc.id)}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                    isSel
                      ? 'border-[var(--ns-accent)] bg-[var(--ns-surface-elevated)]'
                      : 'border-[var(--ns-border)] bg-[var(--ns-surface)] hover:border-[var(--ns-border-strong)]'
                  }`}
                >
                  <MediaThumb src={thumb?.thumbnailUrl} alt={loc.name} className="w-12 rounded shrink-0" aspectClass="aspect-square" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold truncate flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[var(--ns-text-subtle)] shrink-0" />
                      <span className="truncate">{loc.name}</span>
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-muted)] truncate">
                      {loc.interiorExterior || 'EXT'} · {loc.timeOfDay} · {(loc.locationType || 'real_world').replace(/_/g, ' ')}
                    </div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)]">
                      {linkedCount} scene(s) · {loc.approved ? 'Approved' : 'Draft'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
          {!selected ? (
            <p className="text-[var(--ns-text-muted)]">Select or add a location to edit environmental details.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
                <div>
                  <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">{selected.id}</div>
                  <h2 className="font-display text-base font-semibold">{selected.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.upsertLocation({ ...selected, approved: !selected.approved })}
                    className={`h-8 px-3 rounded border font-medium inline-flex items-center gap-1.5 ${
                      selected.approved
                        ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                        : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selected.approved ? 'Location Approved' : 'Approve Location'}</span>
                  </button>
                  {confirmDeleteId === selected.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          store.deleteLocation(selected.id);
                          setConfirmDeleteId(null);
                        }}
                        className="h-8 px-2.5 rounded bg-[var(--ns-danger)] text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-8 px-2.5 rounded border border-[var(--ns-border)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete location ${selected.name}`}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="h-8 px-2.5 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Location Name</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => store.upsertLocation({ ...selected, name: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Location Type</label>
                  <select
                    value={selected.locationType || 'real_world'}
                    onChange={(e) =>
                      store.upsertLocation({ ...selected, locationType: e.target.value as LocationType })
                    }
                    className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="real_world">Real-World Location</option>
                    <option value="studio">Studio / Stage</option>
                    <option value="fictional">Fictional Environment</option>
                    <option value="ai_generated">AI-Generated Environment</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Interior / Exterior</label>
                  <select
                    value={selected.interiorExterior || 'EXT'}
                    onChange={(e) =>
                      store.upsertLocation({ ...selected, interiorExterior: e.target.value as InteriorExterior })
                    }
                    className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="INT">INT (Interior)</option>
                    <option value="EXT">EXT (Exterior)</option>
                    <option value="INT/EXT">INT/EXT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Geographic / District Info</label>
                  <input
                    type="text"
                    value={selected.geographicInfo || ''}
                    onChange={(e) => store.upsertLocation({ ...selected, geographicInfo: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Primary Time of Day</label>
                  <input
                    type="text"
                    value={selected.timeOfDay}
                    onChange={(e) => store.upsertLocation({ ...selected, timeOfDay: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Weather & Atmosphere</label>
                  <input
                    type="text"
                    value={selected.weather}
                    onChange={(e) => store.upsertLocation({ ...selected, weather: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Architectural Style</label>
                  <input
                    type="text"
                    value={selected.architecturalStyle}
                    onChange={(e) => store.upsertLocation({ ...selected, architecturalStyle: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Lighting Setup</label>
                  <input
                    type="text"
                    value={selected.lighting}
                    onChange={(e) => store.upsertLocation({ ...selected, lighting: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Environment Description</label>
                <textarea
                  rows={2}
                  value={selected.environmentDescription}
                  onChange={(e) => store.upsertLocation({ ...selected, environmentDescription: e.target.value })}
                  className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Key Visual Features</label>
                  <textarea
                    rows={2}
                    value={selected.visualFeatures || ''}
                    onChange={(e) => store.upsertLocation({ ...selected, visualFeatures: e.target.value })}
                    className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Environmental Continuity Notes</label>
                  <textarea
                    rows={2}
                    value={selected.continuityNotes}
                    onChange={(e) => store.upsertLocation({ ...selected, continuityNotes: e.target.value })}
                    className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Environment Prompt Anchor</label>
                <input
                  type="text"
                  value={selected.environmentPrompt || ''}
                  onChange={(e) => store.upsertLocation({ ...selected, environmentPrompt: e.target.value })}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--ns-border)]">
                <div className="text-[var(--ns-text-muted)] font-medium">Scene Associations</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {project.scenes.map((sc) => {
                    const checked = selected.sceneIds.includes(sc.id) || sc.locationId === selected.id;
                    return (
                      <label
                        key={sc.id}
                        className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextIds = e.target.checked
                              ? Array.from(new Set([...selected.sceneIds, sc.id]))
                              : selected.sceneIds.filter((x) => x !== sc.id);
                            store.upsertLocation({ ...selected, sceneIds: nextIds });
                            store.updateScene(sc.id, (s) => ({
                              ...s,
                              locationId: e.target.checked ? selected.id : s.locationId === selected.id ? undefined : s.locationId,
                            }));
                          }}
                        />
                        <span className="truncate">{sc.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const PROP_CATEGORIES: Array<{ value: PropCategory; label: string }> = [
  { value: 'handheld', label: 'Handheld Prop' },
  { value: 'background', label: 'Background Object' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'set_decoration', label: 'Set Decoration' },
  { value: 'narrative_object', label: 'Significant Narrative Object' },
];

export function PropsSetDesignView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [selectedId, setSelectedId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [newStateSceneId, setNewStateSceneId] = useState('');
  const [newStateLabel, setNewStateLabel] = useState('');
  const [newStateNotes, setNewStateNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!project) return null;
  const props = project.props || [];
  const selected = props.find((p) => p.id === selectedId) || props[0];

  const handleCreate = () => {
    const id = `prop_${Date.now().toString(36)}`;
    const item: PropSpec = {
      id,
      name: newName.trim() || `Prop ${props.length + 1}`,
      category: 'handheld',
      characterIds: [],
      sceneIds: [],
      description: 'Describe visual details and narrative handling',
      materials: '',
      colors: '',
      dimensions: '',
      narrativeImportance: 'featured',
      referenceAssetIds: [],
      generationPrompt: '',
      sceneStates: [],
      approved: false,
      updatedAt: new Date().toISOString(),
    };
    store.upsertProp(item);
    setSelectedId(id);
    setNewName('');
    store.notify('success', `Added "${item.name}" to Props & Set Design`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Props & Set Design Studio</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Track handheld props, set dressing, furniture, vehicles, narrative objects, and condition changes across scenes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New prop / set element..."
            aria-label="New prop name"
            className="h-9 px-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="h-9 px-3.5 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Prop</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start text-xs">
        <div className="lg:col-span-4 space-y-2">
          {props.length === 0 ? (
            <div className="p-4 rounded-lg border border-[var(--ns-border)] bg-[var(--ns-surface)] text-[var(--ns-text-muted)]">
              No props or set pieces tracked yet.
            </div>
          ) : (
            props.map((prop) => {
              const isSel = selected?.id === prop.id;
              return (
                <button
                  key={prop.id}
                  type="button"
                  onClick={() => setSelectedId(prop.id)}
                  className={`w-full text-left p-3 rounded-lg border space-y-1 transition-colors ${
                    isSel
                      ? 'border-[var(--ns-accent)] bg-[var(--ns-surface-elevated)]'
                      : 'border-[var(--ns-border)] bg-[var(--ns-surface)] hover:border-[var(--ns-border-strong)]'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <Package className="w-3.5 h-3.5 text-[var(--ns-text-subtle)] shrink-0" />
                      <span className="truncate">{prop.name}</span>
                    </span>
                    <span className="text-[11px] font-normal text-[var(--ns-text-subtle)]">
                      {prop.narrativeImportance || 'featured'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--ns-text-muted)]">
                    {(prop.category || 'handheld').replace(/_/g, ' ')} · {prop.sceneIds.length} scene(s) ·{' '}
                    {prop.sceneStates?.length || 0} state(s)
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="lg:col-span-8 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-5 space-y-4">
          {!selected ? (
            <p className="text-[var(--ns-text-muted)]">Select or add a prop to edit set design properties.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ns-border)] pb-3">
                <div>
                  <div className="font-mono text-[11px] text-[var(--ns-text-subtle)]">{selected.id}</div>
                  <h2 className="font-display text-base font-semibold">{selected.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => store.upsertProp({ ...selected, approved: !selected.approved })}
                    className={`h-8 px-3 rounded border font-medium inline-flex items-center gap-1.5 ${
                      selected.approved
                        ? 'border-[var(--ns-success)] text-[var(--ns-success)] bg-[var(--ns-success)]/10'
                        : 'border-[var(--ns-border)] text-[var(--ns-text-muted)]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{selected.approved ? 'Prop Approved' : 'Approve Prop'}</span>
                  </button>
                  {confirmDeleteId === selected.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          store.deleteProp(selected.id);
                          setConfirmDeleteId(null);
                        }}
                        className="h-8 px-2.5 rounded bg-[var(--ns-danger)] text-white"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="h-8 px-2.5 rounded border border-[var(--ns-border)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete prop ${selected.name}`}
                      onClick={() => setConfirmDeleteId(selected.id)}
                      className="h-8 px-2.5 rounded border border-[var(--ns-danger)]/40 text-[var(--ns-danger)]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Prop / Object Name</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => store.upsertProp({ ...selected, name: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Category</label>
                  <select
                    value={selected.category || 'handheld'}
                    onChange={(e) =>
                      store.upsertProp({ ...selected, category: e.target.value as PropCategory })
                    }
                    className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    {PROP_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Narrative Importance</label>
                  <select
                    value={selected.narrativeImportance || 'featured'}
                    onChange={(e) =>
                      store.upsertProp({
                        ...selected,
                        narrativeImportance: e.target.value as PropSpec['narrativeImportance'],
                      })
                    }
                    className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="hero">Hero Narrative Object</option>
                    <option value="featured">Featured Set / Action Prop</option>
                    <option value="background">Background Dressing</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Primary Location</label>
                  <select
                    value={selected.locationId || ''}
                    onChange={(e) =>
                      store.upsertProp({ ...selected, locationId: e.target.value || undefined })
                    }
                    className="w-full h-9 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    <option value="">Portable / Multi-location</option>
                    {(project.locations || []).map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Materials</label>
                  <input
                    type="text"
                    value={selected.materials || ''}
                    onChange={(e) => store.upsertProp({ ...selected, materials: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[var(--ns-text-muted)]">Colors & Dimensions</label>
                  <input
                    type="text"
                    value={selected.colors || ''}
                    onChange={(e) => store.upsertProp({ ...selected, colors: e.target.value })}
                    className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Visual & Functional Description</label>
                <textarea
                  rows={2}
                  value={selected.description}
                  onChange={(e) => store.upsertProp({ ...selected, description: e.target.value })}
                  className="w-full p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[var(--ns-text-muted)]">Prop Generation Prompt</label>
                <input
                  type="text"
                  value={selected.generationPrompt || ''}
                  onChange={(e) => store.upsertProp({ ...selected, generationPrompt: e.target.value })}
                  className="w-full h-9 px-3 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] font-mono"
                />
              </div>

              {/* Prop State Progression Across Scenes */}
              <div className="space-y-2 pt-2 border-t border-[var(--ns-border)]">
                <div className="font-medium text-[var(--ns-text-muted)]">
                  State & Condition Progression Across Scenes (e.g., Intact -&gt; Rain-Speckled -&gt; Damaged)
                </div>
                {(selected.sceneStates || []).map((st, idx) => {
                  const scTitle = project.scenes.find((s) => s.id === st.sceneId)?.title || st.sceneId;
                  return (
                    <div
                      key={`${st.sceneId}_${idx}`}
                      className="p-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)] flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-medium">{scTitle}</span> ·{' '}
                        <span className="text-[var(--ns-accent-blue)]">{st.stateLabel}</span>
                        {st.conditionNotes && (
                          <span className="text-[var(--ns-text-muted)]"> — {st.conditionNotes}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          store.upsertProp({
                            ...selected,
                            sceneStates: (selected.sceneStates || []).filter((_, i) => i !== idx),
                          })
                        }
                        className="text-[var(--ns-danger)]"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    aria-label="Scene for prop state"
                    value={newStateSceneId || project.scenes[0]?.id || ''}
                    onChange={(e) => setNewStateSceneId(e.target.value)}
                    className="sm:col-span-4 h-8 px-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  >
                    {project.scenes.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newStateLabel}
                    onChange={(e) => setNewStateLabel(e.target.value)}
                    placeholder="State (e.g., Intact / Scuffed)"
                    className="sm:col-span-3 h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                  <input
                    type="text"
                    value={newStateNotes}
                    onChange={(e) => setNewStateNotes(e.target.value)}
                    placeholder="Condition notes..."
                    className="sm:col-span-3 h-8 px-2.5 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const targetScene = newStateSceneId || project.scenes[0]?.id;
                      if (!targetScene || !newStateLabel.trim()) return;
                      store.upsertProp({
                        ...selected,
                        sceneIds: Array.from(new Set([...selected.sceneIds, targetScene])),
                        sceneStates: [
                          ...(selected.sceneStates || []),
                          {
                            sceneId: targetScene,
                            stateLabel: newStateLabel.trim(),
                            conditionNotes: newStateNotes.trim(),
                          },
                        ],
                      });
                      setNewStateLabel('');
                      setNewStateNotes('');
                    }}
                    className="sm:col-span-2 h-8 px-3 rounded border border-[var(--ns-border)] bg-[var(--ns-surface-elevated)] font-medium"
                  >
                    Add State
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--ns-border)]">
                <div className="space-y-1.5">
                  <div className="text-[var(--ns-text-muted)] font-medium">Associated Characters</div>
                  {project.characters.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    >
                      <input
                        type="checkbox"
                        checked={selected.characterIds.includes(c.id)}
                        onChange={(e) =>
                          store.upsertProp({
                            ...selected,
                            characterIds: e.target.checked
                              ? Array.from(new Set([...selected.characterIds, c.id]))
                              : selected.characterIds.filter((id) => id !== c.id),
                          })
                        }
                      />
                      <span>{c.name}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="text-[var(--ns-text-muted)] font-medium">Associated Scenes</div>
                  {project.scenes.map((sc) => (
                    <label
                      key={sc.id}
                      className="flex items-center gap-2 p-2 rounded bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                    >
                      <input
                        type="checkbox"
                        checked={selected.sceneIds.includes(sc.id)}
                        onChange={(e) =>
                          store.upsertProp({
                            ...selected,
                            sceneIds: e.target.checked
                              ? Array.from(new Set([...selected.sceneIds, sc.id]))
                              : selected.sceneIds.filter((id) => id !== sc.id),
                          })
                        }
                      />
                      <span className="truncate">{sc.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
