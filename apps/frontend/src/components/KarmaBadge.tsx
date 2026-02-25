interface KarmaBadgeProps {
  karma: number;
  trustScore?: number;
  className?: string;
}

/**
 * KarmaBadge displays a user's karma points and optional trust score stars.
 * Used inline next to TrustPathBadge on feed items and offer cards.
 * Returns null when karma is 0 (nothing meaningful to show).
 */
export default function KarmaBadge({ karma, trustScore, className = '' }: KarmaBadgeProps) {
  if (!karma || karma <= 0) return null;

  const stars = trustScore != null ? Math.min(5, Math.floor((trustScore / 100) * 5)) : null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-medium bg-surface text-text-muted border-border ${className}`}
      title={trustScore != null ? `${karma} karma · trust score ${trustScore}` : `${karma} karma`}
    >
      <span aria-hidden="true">⭐</span>
      <span>{karma}</span>
      {stars !== null && stars > 0 && (
        <span className="flex items-center ml-0.5">
          {[...Array(stars)].map((_, i) => (
            <svg key={i} className="w-2.5 h-2.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </span>
      )}
    </span>
  );
}
