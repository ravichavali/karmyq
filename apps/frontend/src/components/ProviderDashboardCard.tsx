import React from 'react'
import { useProvider } from '../contexts/ProviderContext'

interface ProviderDashboardCardProps {
  activeCommitments?: number
}

const StatCell = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-surface rounded-lg p-3">
    <div className="text-lg font-bold text-text">{value}</div>
    <div className="text-xs text-text-muted mt-0.5">{label}</div>
  </div>
)

const ProviderDashboardCard: React.FC<ProviderDashboardCardProps> = ({ activeCommitments }) => {
  const { providerProfiles } = useProvider()

  if (providerProfiles.length === 0) return null

  // Derive stats from provider profile data (already fetched by ProviderContext)
  // completion_rate and response_rate come from the LEFT JOIN with provider_trust_scores
  const profile = providerProfiles[0] as any
  const completionRate = profile.completion_rate != null
    ? Math.round(Number(profile.completion_rate) * 100)
    : null
  const responseRate = profile.response_rate != null
    ? Math.round(Number(profile.response_rate) * 100)
    : null

  return (
    <div className="bg-surface-raised border border-border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-text">Provider Overview</h2>
        <span className="text-xs text-text-muted">
          {providerProfiles.length} profile{providerProfiles.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCell
          label="Active Commitments"
          value={activeCommitments ?? '—'}
        />
        <StatCell
          label="Completion Rate"
          value={completionRate != null ? `${completionRate}%` : '—'}
        />
        <StatCell
          label="Pending Reviews"
          value="—"
        />
        <StatCell
          label="Response Rate"
          value={responseRate != null ? `${responseRate}%` : '—'}
        />
      </div>
    </div>
  )
}

export default ProviderDashboardCard
