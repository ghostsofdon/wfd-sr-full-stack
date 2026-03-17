import {
  RenewalRiskResponseSchema,
  CalculateRiskResponseSchema,
  RenewalEventResponseSchema,
  type RenewalRiskResponse,
  type CalculateRiskResponse,
  type RenewalEventResponse,
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

// ─── API client ───────────────────────────────────────────────────────────────

export const api = {
  /** GET /api/v1/properties/:propertyId/renewal-risk */
  getRenewalRisk: async (propertyId: string): Promise<RenewalRiskResponse> => {
    const data = await fetchJson<unknown>(
      `${BASE_URL}/properties/${propertyId}/renewal-risk`
    );
    return RenewalRiskResponseSchema.parse(data);
  },

  /** POST /api/v1/properties/:propertyId/renewal-risk/calculate */
  calculateRisk: async (
    propertyId: string,
    asOfDate?: string
  ): Promise<CalculateRiskResponse> => {
    const data = await fetchJson<unknown>(
      `${BASE_URL}/properties/${propertyId}/renewal-risk/calculate`,
      {
        method: 'POST',
        body: JSON.stringify({ asOfDate }),
      }
    );
    return CalculateRiskResponseSchema.parse(data);
  },

  /** POST /api/v1/properties/:propertyId/residents/:residentId/renewal-event */
  triggerRenewalEvent: async (
    propertyId: string,
    residentId: string,
    eventType?: string
  ): Promise<RenewalEventResponse> => {
    const data = await fetchJson<unknown>(
      `${BASE_URL}/properties/${propertyId}/residents/${residentId}/renewal-event`,
      {
        method: 'POST',
        body: JSON.stringify({ eventType: eventType ?? 'renewal_notice_sent' }),
      }
    );
    return RenewalEventResponseSchema.parse(data);
  },
};

export { FetchError };
