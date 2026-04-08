import type { Asset } from '../types'

interface SavedCompositesProps {
  composites: Asset[]
  loading: boolean
  expanded: boolean
  onToggleExpand: () => void
  onAddToTimeline: (url: string) => void
  onDelete: (filename: string) => void
  onView?: (images: { url: string; label?: string }[], startIndex: number) => void
}

export function SavedComposites({ composites, loading, expanded, onToggleExpand, onAddToTimeline, onDelete, onView }: SavedCompositesProps) {
  const filtered = composites.filter(c => !c.filename.startsWith('mask-'))

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)] shrink-0">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] font-[Lato]">
          Saved Composites ({filtered.length})
        </h3>
        <button
          onClick={onToggleExpand}
          className="px-2 py-1 text-[10px] font-semibold text-[var(--color-text-muted)] hover:text-[#171717] cursor-pointer transition-colors"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0">
        {loading ? (
          <div className="text-[10px] text-[var(--color-text-muted)] text-center py-4">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-[10px] text-[var(--color-text-muted)] text-center py-4 leading-relaxed">
            Saved &amp; refined composites appear here
          </div>
        ) : (
          <div className={expanded ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
            {filtered.map((c, idx) => (
              <div key={c.filename} className="glass-card overflow-hidden group relative">
                <img
                  src={c.url}
                  alt={c.filename}
                  className="w-full aspect-video object-cover rounded-t-[12px]"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-[12px] flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                  {onView && (
                    <button
                      onClick={() => onView(filtered.map(f => ({ url: f.url, label: f.filename })), idx)}
                      className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-white text-[#171717] shadow-md hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer"
                    >
                      View
                    </button>
                  )}
                  <button
                    onClick={() => onAddToTimeline(c.url)}
                    className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg bg-white text-[#171717] shadow-md hover:bg-[var(--color-primary)] hover:text-white transition-colors cursor-pointer"
                  >
                    + Timeline
                  </button>
                  <button
                    onClick={() => onDelete(c.filename)}
                    className="px-2 py-1.5 text-[10px] font-semibold rounded-lg bg-white/90 text-red-600 shadow-md hover:bg-red-600 hover:text-white transition-colors cursor-pointer"
                  >
                    x
                  </button>
                </div>
                <div className="px-2 py-1.5 text-[9px] text-[var(--color-text-muted)] truncate">
                  {c.filename}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
