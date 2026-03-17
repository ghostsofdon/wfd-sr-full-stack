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
 * Returns null data if no calculation has been run yet.
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

// ─── useCalculateRisk ─────────────────────────────────────────────────────────

/**
 * Triggers a fresh risk calculation for all active residents of a property.
 * On success, automatically refreshes the risk scores query.
 */
export function useCalculateRisk(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (asOfDate?: string) => api.calculateRisk(propertyId, asOfDate),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: renewalRiskKeys.property(propertyId),
      });
    },
  });
}

// ─── useTriggerRenewalEvent ───────────────────────────────────────────────────

/**
 * Fires a renewal event for a single resident and queues a webhook delivery.
 */
export function useTriggerRenewalEvent(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ residentId, eventType }: { residentId: string; eventType?: string }) =>
      api.triggerRenewalEvent(propertyId, residentId, eventType),
    onSuccess: () => {
      // Optionally refresh the risk list so status updates show immediately
      void queryClient.invalidateQueries({
        queryKey: renewalRiskKeys.property(propertyId),
      });
    },
    // Each resident gets its own mutation state — we keep onError in the component
  });
}
