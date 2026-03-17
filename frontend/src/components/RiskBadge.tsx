import clsx from 'clsx';
import type { RiskTier } from '../types/api';

interface RiskBadgeProps {
  tier: RiskTier;
  score?: number;
  className?: string;
}

const TIER_STYLES: Record<RiskTier, string> = {
  high: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  medium: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  low: 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300',
};

const TIER_LABELS: Record<RiskTier, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function RiskBadge({ tier, score, className }: RiskBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TIER_STYLES[tier],
        className
      )}
      aria-label={`Risk level: ${TIER_LABELS[tier]}${score !== undefined ? `, score ${score}` : ''}`}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', {
          'bg-red-500': tier === 'high',
          'bg-amber-500': tier === 'medium',
          'bg-emerald-500': tier === 'low',
        })}
        aria-hidden="true"
      />
      {TIER_LABELS[tier]}{score !== undefined ? ` (${score})` : ''}
    </span>
  );
}
