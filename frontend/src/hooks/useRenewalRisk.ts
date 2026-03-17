import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const renewalRiskKeys = {
  all: ['renewalRisk'] as const,
  property: (propertyId: string) => ['renewalRisk', propertyId] as const,
};

// ─── useRenewalRisk ───────────────────────────────────────────────────────────

/**
 * Fetches the latest cached renewal risk scores for a property.
 * Returns null/undefined data if no calculation has been run yet.
 */
export function useRenewalRisk(propertyId: string | null) {
  return useQuery({
    queryKey: renewalRiskKeys.property(propertyId ?? ''),
    queryFn: () => api.getRenewalRisk(propertyId!),
    enabled: Boolean(propertyId),
    staleTime: 30_000, // 30s — risk scores don't change in real time
    retry: (count, error) => {
      // Don't retry 404 (no scores yet for this property)
      if ('status' in error && (error as { status: number }).status === 404) return false;
      return count < 2;
    },
  });
}

// ─── useRunBatchScoring ───────────────────────────────────────────────────────

/**
 * Triggers a fresh batch risk scoring run for all active residents of a property.
 * On success, automatically refreshes the risk scores query.
 */
export function useRunBatchScoring(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (asOfDate?: string) => api.runBatchScoring(propertyId, asOfDate),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: renewalRiskKeys.property(propertyId),
      });
    },
  });
}

// ─── useRetryWebhook ─────────────────────────────────────────────────────────

/**
 * Manually retries a failed webhook delivery by webhook log ID.
 */
export function useRetryWebhook() {
  return useMutation({
    mutationFn: (webhookId: string) => api.retryWebhook(webhookId),
  });
}
