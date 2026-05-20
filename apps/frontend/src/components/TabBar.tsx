import React from 'react'

export type TabId = 'browse' | 'helping' | 'asks'

interface Tab {
  id: TabId
  label: string
  mobileLabel: string
  icon: React.ReactNode
}

const BrowseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
)
const CommitmentsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const RequestsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
  </svg>
)
const TABS: Tab[] = [
  { id: 'browse', label: 'Browse', mobileLabel: 'Browse', icon: <BrowseIcon /> },
  { id: 'helping', label: 'Helping', mobileLabel: 'Helping', icon: <CommitmentsIcon /> },
  { id: 'asks', label: 'Asks', mobileLabel: 'Asks', icon: <RequestsIcon /> },
]

interface TabBarProps {
  activeTab: TabId
  onChange: (tab: TabId) => void
  commitmentCount?: number
  dibsCount?: number
  browseLabel?: string  // overrides 'Browse' tab label when provided
}

export default function TabBar({ activeTab, onChange, commitmentCount, dibsCount, browseLabel }: TabBarProps) {
  return (
    <>
      {/* Desktop horizontal tabs */}
      <div className="tab-bar hidden md:flex" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={`tab-bar-item ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.id === 'browse' && browseLabel ? browseLabel : tab.label}
            {tab.id === 'helping' && (dibsCount != null && dibsCount > 0) && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-xs">
                {dibsCount > 9 ? '9+' : dibsCount}
              </span>
            )}
            {tab.id === 'helping' && !(dibsCount != null && dibsCount > 0) && commitmentCount != null && commitmentCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white text-xs">
                {commitmentCount > 9 ? '9+' : commitmentCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
            aria-label={tab.label}
          >
            {tab.icon}
            <span>
              {tab.id === 'browse' && browseLabel ? browseLabel : tab.mobileLabel}
              {tab.id === 'helping' && dibsCount != null && dibsCount > 0 && (
                <span className="ml-0.5 text-amber-500 font-bold">·</span>
              )}
              {tab.id === 'helping' && !(dibsCount != null && dibsCount > 0) && commitmentCount != null && commitmentCount > 0 && (
                <span className="ml-0.5 text-primary font-bold">·</span>
              )}
            </span>
          </button>
        ))}
      </nav>
    </>
  )
}
