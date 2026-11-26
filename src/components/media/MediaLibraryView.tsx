import { useRef, useState } from 'react';
import { FileArchive, Search, Trash2, Upload } from 'lucide-react';
import type { StudioStore } from '../../hooks/useStudioStore';
import type { AssetCategory, MediaAsset } from '../../types/studio';
import { formatBytes, MediaThumb } from '../shared/MediaThumb';

export function MediaLibraryView({ store }: { store: StudioStore }) {
  const project = store.activeProject;
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | AssetCategory>('all');
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>('character');
  const [dragOver, setDragOver] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!project) return null;

  const filteredAssets = project.mediaAssets.filter((asset) => {
    const matchesCat = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesSearch =
      !searchQuery.trim() ||
      asset.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedAsset: MediaAsset | undefined =
    project.mediaAssets.find((a) => a.id === selectedAssetId) || filteredAssets[0];

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await store.uploadMedia(files, uploadCategory);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Media Library & Ingestion</h1>
          <p className="text-xs text-[var(--ns-text-muted)] mt-1">
            Upload JPG, PNG, WEBP images or ZIP archives. Originals remain untouched with SHA-256 duplicate protection.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="upload-category-select" className="text-xs text-[var(--ns-text-muted)]">
            Default Category
          </label>
          <select
            id="upload-category-select"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
            className="h-9 px-2.5 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          >
            <option value="character">Character</option>
            <option value="environment">Environment</option>
            <option value="storyboard">Storyboard</option>
            <option value="prop">Prop</option>
            <option value="style_reference">Style Reference</option>
          </select>
        </div>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-[var(--ns-accent)] bg-[var(--ns-accent)]/10'
            : 'border-[var(--ns-border)] bg-[var(--ns-surface)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.zip"
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[var(--ns-text-muted)]">
            <Upload className="w-5 h-5" />
            <FileArchive className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium">
            {uploading ? 'Extracting & indexing media assets...' : 'Drop images or ZIP archives here'}
          </p>
          <p className="text-xs text-[var(--ns-text-subtle)]">
            Supports JPEG, JPG, PNG, WEBP, and structured .ZIP batches up to 20 MB per image.
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 h-9 px-4 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium"
          >
            Select Files or ZIP
          </button>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-md">
          {(['all', 'character', 'environment', 'storyboard', 'prop', 'style_reference'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-[var(--ns-accent)] text-white'
                  : 'text-[var(--ns-text-muted)] hover:text-[var(--ns-text)]'
              }`}
            >
              {cat === 'all' ? 'All Assets' : cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ns-text-subtle)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by filename or ID..."
            aria-label="Filter media assets"
            className="w-full h-9 pl-8 pr-3 text-xs rounded-md bg-[var(--ns-surface)] border border-[var(--ns-border)]"
          />
        </div>
      </div>

      {/* Asset Grid + Metadata Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filteredAssets.length === 0 ? (
            <div className="col-span-full bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-8 text-center text-xs text-[var(--ns-text-muted)]">
              No media assets match your current filter. Upload images or a ZIP archive above.
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const isSelected = selectedAsset?.id === asset.id;
              const analyzed = Boolean(project.analyses[asset.id]);
              return (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelectedAssetId(asset.id)}
                  className={`text-left bg-[var(--ns-surface)] border rounded-lg overflow-hidden transition-colors ${
                    isSelected
                      ? 'border-[var(--ns-accent)]'
                      : 'border-[var(--ns-border)] hover:border-[var(--ns-border-strong)]'
                  }`}
                >
                  <MediaThumb src={asset.thumbnailUrl} alt={asset.fileName} aspectClass="aspect-[4/3]" />
                  <div className="p-2.5 space-y-1">
                    <div className="text-xs font-medium truncate">{asset.fileName}</div>
                    <div className="text-[11px] text-[var(--ns-text-subtle)] tabular-nums truncate">
                      {asset.width}x{asset.height} · {formatBytes(asset.fileSizeBytes)} ·{' '}
                      <span className={analyzed ? 'text-[var(--ns-success)]' : ''}>
                        {analyzed ? 'Analyzed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Asset Detail Inspector */}
        <aside className="lg:col-span-4 bg-[var(--ns-surface)] border border-[var(--ns-border)] rounded-lg p-4 space-y-4">
          {selectedAsset ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-semibold truncate">{selectedAsset.fileName}</h2>
                <button
                  type="button"
                  aria-label={`Remove ${selectedAsset.fileName}`}
                  onClick={() => {
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      mediaAssets: proj.mediaAssets.filter((a) => a.id !== selectedAsset.id),
                    }));
                    setSelectedAssetId(null);
                    store.notify('info', `Removed ${selectedAsset.fileName}`);
                  }}
                  className="p-1.5 rounded border border-[var(--ns-border)] text-[var(--ns-danger)] hover:bg-[var(--ns-danger)]/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <MediaThumb
                src={selectedAsset.dataUrl}
                alt={selectedAsset.fileName}
                className="rounded border border-[var(--ns-border)]"
                aspectClass="aspect-video"
              />

              <div className="text-xs space-y-2 divide-y divide-[var(--ns-border)]">
                <div className="pt-1 flex justify-between gap-2">
                  <span className="text-[var(--ns-text-muted)]">Asset ID</span>
                  <span className="font-mono truncate max-w-[180px]">{selectedAsset.id}</span>
                </div>
                <div className="pt-2 flex justify-between gap-2">
                  <span className="text-[var(--ns-text-muted)]">Dimensions</span>
                  <span className="font-mono tabular-nums">
                    {selectedAsset.width} x {selectedAsset.height} px
                  </span>
                </div>
                <div className="pt-2 flex justify-between gap-2">
                  <span className="text-[var(--ns-text-muted)]">File Size</span>
                  <span className="font-mono tabular-nums">{formatBytes(selectedAsset.fileSizeBytes)}</span>
                </div>
                <div className="pt-2 flex justify-between gap-2">
                  <span className="text-[var(--ns-text-muted)]">SHA-256</span>
                  <span className="font-mono truncate max-w-[160px]">{selectedAsset.sha256}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <label htmlFor="asset-category-edit" className="block text-xs font-medium text-[var(--ns-text-muted)]">
                  Asset Category
                </label>
                <select
                  id="asset-category-edit"
                  value={selectedAsset.category}
                  onChange={(e) => {
                    const nextCat = e.target.value as AssetCategory;
                    store.updateActiveProject((proj) => ({
                      ...proj,
                      mediaAssets: proj.mediaAssets.map((a) =>
                        a.id === selectedAsset.id ? { ...a, category: nextCat } : a
                      ),
                    }));
                  }}
                  className="w-full h-9 px-2.5 text-xs rounded-md bg-[var(--ns-surface-inset)] border border-[var(--ns-border)]"
                >
                  <option value="character">Character</option>
                  <option value="environment">Environment</option>
                  <option value="storyboard">Storyboard</option>
                  <option value="prop">Prop</option>
                  <option value="style_reference">Style Reference</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => store.setActiveSection('intelligence')}
                className="w-full h-9 rounded-md bg-[var(--ns-accent)] hover:bg-[var(--ns-accent-hover)] text-white text-xs font-medium"
              >
                Inspect in Image Intelligence
              </button>
            </>
          ) : (
            <p className="text-xs text-[var(--ns-text-muted)]">Select an asset to inspect metadata.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
