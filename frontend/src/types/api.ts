import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

export const RiskTierSchema = z.enum(['high', 'medium', 'low']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

// ─── Risk Signals (normalised to camelCase for frontend use) ──────────────────

export const RiskSignalsSchema = z.object({
  daysToExpiry: z.number().nullable(),
  paymentHistoryDelinquent: z.boolean(),
  noRenewalOfferYet: z.boolean(),
  rentGrowthAboveMarket: z.boolean(),
  currentRent: z.number(),
  marketRent: z.number().nullable(),
  rentDeltaPct: z.number().nullable(),
});
export type RiskSignals = z.infer<typeof RiskSignalsSchema>;

// ─── Risk Score Entry (normalised) ───────────────────────────────────────────

export const RiskEntrySchema = z.object({
  id: z.string(),
  residentId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  unitId: z.string().nullable(),
  riskScore: z.number(),
  riskTier: RiskTierSchema,
  calculatedAt: z.string().nullable(),
  asOfDate: z.string().nullable(),
  signals: RiskSignalsSchema.nullable(),
});
export type RiskEntry = z.infer<typeof RiskEntrySchema>;

// ─── GET /renewal-risk response (normalised) ──────────────────────────────────

export const RenewalRiskResponseSchema = z.object({
  propertyId: z.string(),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  results: z.array(RiskEntrySchema),
});
export type RenewalRiskResponse = z.infer<typeof RenewalRiskResponseSchema>;

// ─── POST /renewal-risk/batch response ───────────────────────────────────────

export const BatchRiskResponseSchema = z.object({
  message: z.string(),
  propertyId: z.string(),
  asOfDate: z.string(),
  processed: z.number(),
  highRisk: z.number(),
  mediumRisk: z.number(),
  lowRisk: z.number(),
  webhooksQueued: z.number(),
});
export type BatchRiskResponse = z.infer<typeof BatchRiskResponseSchema>;

// ─── GET /webhooks response ───────────────────────────────────────────────────

export const WebhookLogSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  residentId: z.string(),
  residentName: z.string(),
  eventType: z.string(),
  status: z.enum(['pending', 'delivered', 'failed', 'dlq']),
  attemptCount: z.number(),
  lastAttemptAt: z.string().nullable(),
  nextRetryAt: z.string().nullable(),
  rmsResponseStatus: z.number().nullable(),
  createdAt: z.string(),
  dlqReason: z.string().nullable(),
});
export type WebhookLog = z.infer<typeof WebhookLogSchema>;

export const WebhookListResponseSchema = z.object({
  propertyId: z.string(),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
  results: z.array(WebhookLogSchema),
});
export type WebhookListResponse = z.infer<typeof WebhookListResponseSchema>;

// ─── Error shape ──────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}
