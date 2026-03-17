/**
 * Batch Risk Scoring Service
 * 
 * Runs the full renewal-risk calculation pipeline for a property:
 * 1. Fetch all active leases expiring within 90 days
 * 2. For each resident, gather signals from DB
 * 3. Calculate risk score
 * 4. Upsert RenewalRiskScore + RiskSignal
 * 5. Enqueue webhooks for high/medium residents
 */
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { calculateRiskScore, calcRentGrowthAboveMarket } from './riskScoring';
import { enqueueWebhook, deliverWebhook } from './webhookDelivery';

const DAYS_WINDOW = 90;

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export async function runBatchScoring(propertyId: string, asOfDate?: Date): Promise<{
  processed: number;
  highRisk: number;
  mediumRisk: number;
  lowRisk: number;
  webhooksQueued: number;
}> {
  const today = asOfDate ?? new Date();
  const windowEnd = addDays(today, DAYS_WINDOW);

  // Fetch active leases expiring within window — single query with all related data
  const leases = await prisma.lease.findMany({
    where: {
      propertyId,
      status: 'active',
      leaseEndDate: {
        gte: today,
        lte: windowEnd,
      },
    },
    include: {
      resident: true,
      unit: {
        include: {
          pricing: {
            orderBy: { effectiveDate: 'desc' },
            take: 1,
          },
        },
      },
      renewalOffers: {
        where: { status: { in: ['pending', 'accepted'] } },
        take: 1,
      },
    },
  });

  // Batch fetch ledger delinquency in one query rather than N+1
  const residentIds = leases.map((l: { residentId: string }) => l.residentId);
  const delinquentSet = await getDelinquentResidents(propertyId, residentIds);

  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;
  let webhooksQueued = 0;

  for (const lease of leases) {
    const daysToExpiry = daysBetween(today, lease.leaseEndDate);
    const paymentHistoryDelinquent = delinquentSet.has(lease.residentId);
    const noRenewalOfferYet = lease.renewalOffers.length === 0;

    const latestPricing = lease.unit.pricing[0] ?? null;
    const marketRent = latestPricing ? Number(latestPricing.marketRent) : null;
    const currentRent = Number(lease.monthlyRent);
    const rentGrowthAboveMarket = calcRentGrowthAboveMarket(currentRent, marketRent);

    const result = calculateRiskScore({
      daysToExpiry,
      paymentHistoryDelinquent,
      noRenewalOfferYet,
      rentGrowthAboveMarket,
      currentRent,
      marketRent,
    });

    // Upsert risk score — one score per resident per calendar day
    const upserted = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const riskScore = await tx.renewalRiskScore.upsert({
        where: {
          residentId_asOfDate: {
            residentId: lease.residentId,
            asOfDate: today,
          },
        },
        create: {
          propertyId,
          residentId: lease.residentId,
          leaseId: lease.id,
          riskScore: result.score,
          riskTier: result.tier,
          calculatedAt: new Date(),
          asOfDate: today,
        },
        update: {
          riskScore: result.score,
          riskTier: result.tier,
          calculatedAt: new Date(),
        },
      });

      // Upsert linked signals
      await tx.riskSignal.upsert({
        where: { riskScoreId: riskScore.id },
        create: {
          riskScoreId: riskScore.id,
          propertyId,
          residentId: lease.residentId,
          daysToExpiry,
          paymentHistoryDelinquent,
          noRenewalOfferYet,
          rentGrowthAboveMarket,
          currentRent,
          marketRent,
          rentDeltaPct:
            marketRent !== null
              ? Number((((marketRent - currentRent) / currentRent) * 100).toFixed(2))
              : null,
          recordedAt: new Date(),
        },
        update: {
          daysToExpiry,
          paymentHistoryDelinquent,
          noRenewalOfferYet,
          rentGrowthAboveMarket,
          currentRent,
          marketRent,
          rentDeltaPct:
            marketRent !== null
              ? Number((((marketRent - currentRent) / currentRent) * 100).toFixed(2))
              : null,
          recordedAt: new Date(),
        },
      });

      return riskScore;
    });

    // Tally tiers
    if (result.tier === 'high') highRisk++;
    else if (result.tier === 'medium') mediumRisk++;
    else lowRisk++;

    // Send webhooks for high & medium risk only
    if (result.tier === 'high' || result.tier === 'medium') {
      const eventId = `renewal.risk_flagged.${upserted.id}`;

      const payload = {
        event_type: 'renewal.risk_flagged',
        event_id: eventId,
        occurred_at: new Date().toISOString(),
        property_id: propertyId,
        resident_id: lease.residentId,
        lease_id: lease.id,
        risk_score: result.score,
        risk_tier: result.tier,
        signals: {
          days_to_expiry: daysToExpiry,
          payment_history_delinquent: paymentHistoryDelinquent,
          no_renewal_offer_yet: noRenewalOfferYet,
          rent_growth_above_market: rentGrowthAboveMarket,
          current_rent: currentRent,
          market_rent: marketRent,
        },
      };

      await enqueueWebhook({
        eventId,
        propertyId,
        residentId: lease.residentId,
        eventType: 'renewal.risk_flagged',
        payload,
      });

      // Attempt immediate delivery (fire-and-forget; retry worker covers failures)
      deliverWebhook(
        (await prisma.webhookDeliveryLog.findUnique({ where: { eventId } }))?.id ?? ''
      ).catch((err) => console.warn('[webhook] immediate delivery error:', err));

      webhooksQueued++;
    }
  }

  return {
    processed: leases.length,
    highRisk,
    mediumRisk,
    lowRisk,
    webhooksQueued,
  };
}

/**
 * Returns a Set of residentIds that have payment delinquency.
 * Delinquent = has a charge in the last 90 days that was NOT fully offset by payments.
 * Simplified to: net balance (charges - payments) of any rent charge > $0 in past 90 days.
 */
async function getDelinquentResidents(
  propertyId: string,
  residentIds: string[]
): Promise<Set<string>> {
  if (residentIds.length === 0) return new Set();

  const ninetyDaysAgo = addDays(new Date(), -90);

  // Sum by resident: positive net = delinquent
  const rows = await prisma.residentLedger.groupBy({
    by: ['residentId', 'transactionType'],
    where: {
      propertyId,
      residentId: { in: residentIds },
      transactionDate: { gte: ninetyDaysAgo },
      chargeCode: { in: ['rent', 'late_fee'] },
    },
    _sum: { amount: true },
  });

  // Aggregate by resident
  const balances = new Map<string, number>();
  for (const row of rows) {
    const current = balances.get(row.residentId) ?? 0;
    const amount = Number(row._sum.amount ?? 0);
    if (row.transactionType === 'charge') {
      balances.set(row.residentId, current + amount);
    } else if (row.transactionType === 'payment') {
      balances.set(row.residentId, current - amount);
    }
  }

  const delinquent = new Set<string>();
  for (const [id, balance] of balances.entries()) {
    if (balance > 0) delinquent.add(id);
  }
  return delinquent;
}
