interface VideoPlayerProps {
  url: string
  title: string
  onClose: () => void
}

export function VideoPlayer({ url, title, onClose }: VideoPlayerProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 10000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl overflow-hidden w-full max-w-2xl mx-4"
        style={{ background: '#ffffff', border: '1px solid #D2D2D2', boxShadow: '0 12px 48px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#D2D2D2]">
          <h3 className="text-sm font-bold font-[Lato] text-[#171717] truncate">{title}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#F0F0F0] hover:bg-red-50 hover:text-red-600 flex items-center justify-center text-[#8C8C8C] text-sm transition-colors cursor-pointer"
          >
            &times;
          </button>
        </div>
        <div className="bg-black">
          <video
            src={url}
            controls
            autoPlay
            className="w-full max-h-[70vh]"
          />
        </div>
        <div className="flex justify-end px-4 py-3">
          <a
            href={url}
            download
            className="px-4 py-2 text-[11px] font-semibold rounded-xl bg-[#171717] text-white hover:bg-[#404040] transition-colors cursor-pointer"
          >
            Download
          </a>
        </div>
      </div>
    </div>
  )
}
