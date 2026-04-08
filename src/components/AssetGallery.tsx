import { useRef, useState } from 'react'
import type { AssetType } from '../types'
import { useAssets } from '../hooks/useAssets'
import { GenerateModal } from './GenerateModal'

interface AssetGalleryProps {
  type: AssetType
  label: string
  onSelect: (url: string) => void
  onView?: (images: { url: string; label?: string }[], startIndex: number) => void
}

export function AssetGallery({ type, label, onSelect, onView }: AssetGalleryProps) {
  const { assets, loading, generating, error, upload, remove, generate } = useAssets(type)
  const [showGenerate, setShowGenerate] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) Array.from(files).forEach(f => upload(f))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] shrink-0">
        <h3 className="text-[14px] font-bold uppercase tracking-widest text-white bg-black px-3 py-1 rounded-r-full">{label}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => fileRef.current?.click()}
            className="px-2.5 py-1 text-[9px] font-semibold rounded-lg bg-[#e0e0e0] text-[#333] hover:bg-[#d0d0d0] transition-colors cursor-pointer"
          >
            Upload
          </button>
          <button
            onClick={() => setShowGenerate(true)}
            className="px-2.5 py-1 text-[9px] font-semibold rounded-lg bg-[#171717] text-white hover:bg-[#404040] transition-colors cursor-pointer"
          >
            Generate
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
      </div>

      {error && (
        <div className="px-3 py-1 text-[10px] text-red-600 bg-red-50 border-b border-red-100 shrink-0">{error}</div>
      )}

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0">
        {loading && <div className="text-[10px] text-[var(--color-text-muted)] p-2 text-center">Loading...</div>}
        {!loading && assets.length === 0 && (
          <div className="text-[10px] text-[var(--color-text-muted)] p-3 text-center">
            No {label.toLowerCase()} yet
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {assets.map((asset, idx) => (
            <div
              key={asset.filename}
              className="glass-card group relative overflow-hidden cursor-pointer"
              onClick={() => onSelect(asset.url)}
            >
              <img
                src={asset.url}
                alt={asset.filename}
                className="w-full aspect-square object-cover rounded-t-[12px]"
                draggable={false}
              />
              <div className="px-1.5 py-1">
                <span className="text-[8px] font-medium text-[var(--color-text-muted)] truncate block">
                  {asset.filename}
                </span>
              </div>
              {onView && (
                <button
                  onClick={e => { e.stopPropagation(); onView(assets.map(a => ({ url: a.url, label: a.filename })), idx) }}
                  className="absolute top-1 left-1 px-3 py-0.5 rounded-md bg-white/80 text-[var(--color-text)] text-[8px] font-semibold opacity-0 group-hover:opacity-100 transition-all hover:bg-white cursor-pointer"
                  title="View"
                >
                  View
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); remove(asset.filename) }}
                className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white/80 text-[var(--color-text)] text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-600 cursor-pointer"
                title="Delete"
              >
                x
              </button>
            </div>
          ))}
        </div>
      </div>

      {showGenerate && (
        <GenerateModal
          title={`generate ${label.toLowerCase()}`}
          onGenerate={generate}
          onClose={() => setShowGenerate(false)}
          generating={generating}
        />
      )}
    </div>
  )
}
