import React from 'react';

interface TrustScoreBadgeProps {
  score: number | null | undefined;
  size?: 'sm' | 'md';
}

function getBadgeColor(score: number): string {
  if (score >= 80) return 'bg-success-light text-success';
  if (score >= 60) return 'bg-primary-light text-primary';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-500';
}

export default function TrustScoreBadge({ score, size = 'md' }: TrustScoreBadgeProps) {
  if (score === null || score === undefined) {
    return (
      <span className={`inline-flex items-center rounded-full font-medium bg-gray-100 text-gray-400 ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
        No score yet
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ${getBadgeColor(score)} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
      {Math.round(score)} trust
    </span>
  );
}
