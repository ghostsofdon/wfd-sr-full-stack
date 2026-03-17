import {
  RenewalRiskResponseSchema,
  BatchRiskResponseSchema,
  WebhookListResponseSchema,
  type RenewalRiskResponse,
  type BatchRiskResponse,
  type WebhookListResponse,
  type ApiError,
} from '../types/api';

const BASE_URL = '/api/v1';

class FetchError extends Error implements ApiError {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'FetchError';
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  const json = await response.json().catch(() => ({ message: response.statusText }));

  if (!response.ok) {
    throw new FetchError(
      response.status,
      json?.message ?? `HTTP ${response.status}`,
      json?.code
    );
  }

  return json as T;
}

// ─── snake_case → camelCase normalisation helpers ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseSignals(s: any) {
  if (!s) return null;
  return {
    daysToExpiry: s.days_to_expiry ?? null,
    paymentHistoryDelinquent: Boolean(s.payment_history_delinquent),
    noRenewalOfferYet: Boolean(s.no_renewal_offer_yet),
    rentGrowthAboveMarket: Boolean(s.rent_growth_above_market),
    currentRent: Number(s.current_rent ?? 0),
    marketRent: s.market_rent != null ? Number(s.market_rent) : null,
    rentDeltaPct: s.rent_delta_pct != null ? Number(s.rent_delta_pct) : null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseRiskEntry(r: any) {
  return {
    id: r.id,
    residentId: r.resident_id,
    name: r.resident_name ?? '',
    email: r.resident_email ?? null,
    unitId: r.unit_id ?? null,
    riskScore: Number(r.risk_score),
    riskTier: r.risk_tier,
    calculatedAt: r.calculated_at ? String(r.calculated_at) : null,
    asOfDate: r.as_of_date ? String(r.as_of_date) : null,
    signals: normaliseSignals(r.signals),
  };
}

// ─── API client ───────────────────────────────────────────────────────────────

export const api = {
  /**
   * GET /api/v1/properties/:propertyId/renewal-risk
   * Returns paginated risk scores for the property.
   */
  getRenewalRisk: async (
    propertyId: string,
    opts?: { tier?: 'high' | 'medium' | 'low'; limit?: number; offset?: number; asOfDate?: string }
  ): Promise<RenewalRiskResponse> => {
    const params = new URLSearchParams();
    if (opts?.tier) params.set('tier', opts.tier);
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.offset != null) params.set('offset', String(opts.offset));
    if (opts?.asOfDate) params.set('as_of_date', opts.asOfDate);
    const qs = params.toString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await fetchJson<unknown>(
      `${BASE_URL}/properties/${propertyId}/renewal-risk${qs ? `?${qs}` : ''}`
    );

    const normalised = {
      propertyId: raw.property_id,
      total: raw.total,
      limit: raw.limit,
      offset: raw.offset,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: (raw.results ?? []).map((r: any) => normaliseRiskEntry(r)),
    };

    return RenewalRiskResponseSchema.parse(normalised);
  },

  /**
   * POST /api/v1/properties/:propertyId/renewal-risk/batch
   * Triggers a fresh batch risk scoring run.
   */
  runBatchScoring: async (
    propertyId: string,
    asOfDate?: string
  ): Promise<BatchRiskResponse> => {
    const params = new URLSearchParams();
    if (asOfDate) params.set('as_of_date', asOfDate);
    const qs = params.toString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await fetchJson<unknown>(
      `${BASE_URL}/properties/${propertyId}/renewal-risk/batch${qs ? `?${qs}` : ''}`,
      { method: 'POST' }
    );

    const normalised = {
      message: raw.message ?? '',
      propertyId: raw.property_id,
      asOfDate: raw.as_of_date ?? '',
      processed: raw.processed ?? 0,
      highRisk: raw.highRisk ?? raw.high_risk ?? 0,
      mediumRisk: raw.mediumRisk ?? raw.medium_risk ?? 0,
      lowRisk: raw.lowRisk ?? raw.low_risk ?? 0,
      webhooksQueued: raw.webhooksQueued ?? raw.webhooks_queued ?? 0,
    };

    return BatchRiskResponseSchema.parse(normalised);
  },

  /**
   * GET /api/v1/properties/:propertyId/webhooks
   * Returns paginated webhook delivery logs.
   */
  getWebhooks: async (
    propertyId: string,
    opts?: { status?: 'pending' | 'delivered' | 'failed' | 'dlq'; limit?: number; offset?: number }
  ): Promise<WebhookListResponse> => {
    const params = new URLSearchParams();
    if (opts?.status) params.set('status', opts.status);
    if (opts?.limit != null) params.set('limit', String(opts.limit));
    if (opts?.offset != null) params.set('offset', String(opts.offset));
    const qs = params.toString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await fetchJson<unknown>(
      `${BASE_URL}/properties/${propertyId}/webhooks${qs ? `?${qs}` : ''}`
    );

    const normalised = {
      propertyId: raw.property_id,
      total: raw.total,
      limit: raw.limit,
      offset: raw.offset,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      results: (raw.results ?? []).map((l: any) => ({
        id: l.id,
        eventId: l.event_id,
        residentId: l.resident_id,
        residentName: l.resident_name ?? '',
        eventType: l.event_type,
        status: l.status,
        attemptCount: l.attempt_count ?? 0,
        lastAttemptAt: l.last_attempt_at ? String(l.last_attempt_at) : null,
        nextRetryAt: l.next_retry_at ? String(l.next_retry_at) : null,
        rmsResponseStatus: l.rms_response_status ?? null,
        createdAt: String(l.created_at),
        dlqReason: l.dlq_reason ?? null,
      })),
    };

    return WebhookListResponseSchema.parse(normalised);
  },

  /**
   * POST /api/v1/webhooks/:webhookId/retry
   * Manually retries a failed webhook delivery.
   */
  retryWebhook: async (webhookId: string): Promise<{ message: string; webhookId: string }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await fetchJson<unknown>(`${BASE_URL}/webhooks/${webhookId}/retry`, {
      method: 'POST',
    });
    return { message: raw.message ?? '', webhookId: raw.webhook_id ?? webhookId };
  },
};

export { FetchError };
