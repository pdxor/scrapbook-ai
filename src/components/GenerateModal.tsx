import { useState } from 'react'

interface GenerateModalProps {
  title: string
  onGenerate: (prompt: string) => Promise<void>
  onClose: () => void
  generating: boolean
}

export function GenerateModal({ title, onGenerate, onClose, generating }: GenerateModalProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    await onGenerate(prompt.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="rounded-2xl p-6 w-full max-w-md mx-4"
        style={{ background: '#ffffff', border: '1px solid #D2D2D2', boxShadow: '0 12px 48px rgba(0,0,0,0.2)', color: '#171717' }}
      >
        <h3 className="text-lg font-bold font-[Lato] lowercase tracking-wider mb-4">{title}</h3>
        <form onSubmit={handleSubmit}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe what you want to generate..."
            className="w-full h-28 bg-white border border-[#D2D2D2] rounded-xl p-3 text-sm text-[#171717] resize-none focus:outline-none focus:border-[#171717] transition-colors"
            disabled={generating}
            autoFocus
          />
          <div className="flex gap-3 mt-4 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={generating}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-transparent border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating || !prompt.trim()}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-[#171717] text-white hover:bg-[#404040] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </span>
              ) : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
