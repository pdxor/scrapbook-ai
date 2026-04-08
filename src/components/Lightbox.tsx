import { useEffect, useCallback } from 'react'

interface LightboxProps {
  images: { url: string; label?: string }[]
  currentIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}

export function Lightbox({ images, currentIndex, onClose, onPrev, onNext }: LightboxProps) {
  const current = images[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < images.length - 1

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && hasPrev) onPrev()
    if (e.key === 'ArrowRight' && hasNext) onNext()
  }, [onClose, onPrev, onNext, hasPrev, hasNext])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white text-xl flex items-center justify-center transition-colors cursor-pointer"
      >
        ✕
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={e => { e.stopPropagation(); onPrev() }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors cursor-pointer"
        >
          ‹
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={e => { e.stopPropagation(); onNext() }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white text-2xl flex items-center justify-center transition-colors cursor-pointer"
        >
          ›
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-w-[90vw] max-h-[85vh] flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={current.url}
          alt={current.label || ''}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
          draggable={false}
        />
        {current.label && (
          <div className="mt-3 text-white/80 text-xs font-medium tracking-wide">
            {current.label}
          </div>
        )}
        <div className="mt-1 text-white/40 text-[10px]">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  )
}
