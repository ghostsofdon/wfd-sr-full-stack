import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────────────

export const RiskTierSchema = z.enum(['high', 'medium', 'low']);
export type RiskTier = z.infer<typeof RiskTierSchema>;

// ─── Risk Signals ─────────────────────────────────────────────────────────────

export const RiskSignalsSchema = z.object({
  daysToExpiryDays: z.number(),
  paymentHistoryDelinquent: z.boolean(),
  noRenewalOfferYet: z.boolean(),
  rentGrowthAboveMarket: z.boolean(),
  isMonthToMonth: z.boolean(),
});
export type RiskSignals = z.infer<typeof RiskSignalsSchema>;

// ─── Risk Score Entry ─────────────────────────────────────────────────────────

export const RiskEntrySchema = z.object({
  residentId: z.string(),
  name: z.string(),
  email: z.string().optional(),
  unitNumber: z.string(),
  riskScore: z.number(),
  riskTier: RiskTierSchema,
  daysToExpiry: z.number().nullable(),
  leaseEndDate: z.string().nullable(),
  monthlyRent: z.number(),
  marketRent: z.number().nullable(),
  signals: RiskSignalsSchema,
});
export type RiskEntry = z.infer<typeof RiskEntrySchema>;

// ─── GET /renewal-risk response ───────────────────────────────────────────────

export const RenewalRiskResponseSchema = z.object({
  propertyId: z.string(),
  calculatedAt: z.string().nullable(),
  totalResidents: z.number(),
  flaggedCount: z.number(),
  riskTiers: z.object({
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  flags: z.array(RiskEntrySchema),
});
export type RenewalRiskResponse = z.infer<typeof RenewalRiskResponseSchema>;

// ─── POST /renewal-risk/calculate response ────────────────────────────────────

export const CalculateRiskResponseSchema = z.object({
  propertyId: z.string(),
  calculatedAt: z.string(),
  totalResidents: z.number(),
  flaggedCount: z.number(),
  riskTiers: z.object({
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  flags: z.array(RiskEntrySchema),
});
export type CalculateRiskResponse = z.infer<typeof CalculateRiskResponseSchema>;

// ─── POST /renewal-event response ─────────────────────────────────────────────

export const RenewalEventResponseSchema = z.object({
  eventId: z.string(),
  residentId: z.string(),
  propertyId: z.string(),
  webhookStatus: z.enum(['queued', 'delivered', 'failed']),
  message: z.string(),
});
export type RenewalEventResponse = z.infer<typeof RenewalEventResponseSchema>;

// ─── Error shape ──────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}
