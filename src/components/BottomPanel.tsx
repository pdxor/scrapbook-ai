import type { ReactNode } from 'react'

type TabId = 'storyboard' | 'video-buddy' | 'video-gallery'

interface Tab {
  id: TabId
  label: string
  badge?: number | string
  pulse?: boolean
  icon?: ReactNode
}

interface BottomPanelProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  tabs: Tab[]
  children: ReactNode
}

export function BottomPanel({ activeTab, onTabChange, tabs, children }: BottomPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] shrink-0 px-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-5 py-2.5 text-[11px] font-semibold tracking-wide transition-colors cursor-pointer flex items-center gap-2 border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#546246] text-[#171717]'
                : 'border-transparent text-[#8C8C8C] hover:text-[#646464]'
            }`}
          >
            {tab.icon}
            <span className="uppercase font-[Lato]">{tab.label}</span>
            {tab.pulse && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
            {tab.badge !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                activeTab === tab.id ? 'bg-[#546246] text-white' : 'bg-[#F0F0F0] text-[#8C8C8C]'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

export type { TabId }
