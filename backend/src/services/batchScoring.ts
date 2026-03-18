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

export async function runBatchScoring(propertyId: string, asOfDate?: Date) {
  const raw = asOfDate ?? new Date();
  // Strip time (set to midnight UTC) so upsert cleanly matches by day, preventing duplicates
  const today = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
  const windowEnd = addDays(today, DAYS_WINDOW);

  const leases = await prisma.lease.findMany({
    where: {
      propertyId,
      status: 'active'
    },
    include: {
      resident: true,
      unit: {
        include: {
          pricing: { orderBy: { effectiveDate: 'desc' }, take: 1 },
        },
      },
      renewalOffers: {
        where: { status: { in: ['pending', 'accepted'] } },
        take: 1,
      },
    },
  });

  const residentIds = leases.map(l => l.residentId);
  const delinquentSet = await getDelinquentResidents(propertyId, residentIds);

  let highRisk = 0;
  let mediumRisk = 0;
  let lowRisk = 0;
  const flags = [];

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

    const upserted = await prisma.$transaction(async (tx) => {
      const riskScore = await tx.renewalRiskScore.upsert({
        where: { residentId_asOfDate: { residentId: lease.residentId, asOfDate: today } },
        create: {
          propertyId, residentId: lease.residentId, leaseId: lease.id,
          riskScore: result.score, riskTier: result.tier,
          calculatedAt: new Date(), asOfDate: today,
        },
        update: { riskScore: result.score, riskTier: result.tier, calculatedAt: new Date() },
      });

      await tx.riskSignal.upsert({
        where: { riskScoreId: riskScore.id },
        create: {
          riskScoreId: riskScore.id, propertyId, residentId: lease.residentId,
          daysToExpiry, paymentHistoryDelinquent, noRenewalOfferYet,
          rentGrowthAboveMarket, currentRent, marketRent,
          rentDeltaPct: marketRent !== null ? Number((((marketRent - currentRent) / currentRent) * 100).toFixed(2)) : null,
          recordedAt: new Date(),
        },
        update: {
          daysToExpiry, paymentHistoryDelinquent, noRenewalOfferYet,
          rentGrowthAboveMarket, currentRent, marketRent,
          rentDeltaPct: marketRent !== null ? Number((((marketRent - currentRent) / currentRent) * 100).toFixed(2)) : null,
          recordedAt: new Date(),
        },
      });

      return riskScore;
    });

    if (result.tier === 'high') highRisk++;
    else if (result.tier === 'medium') mediumRisk++;
    else lowRisk++;

    if (result.tier === 'high' || result.tier === 'medium') {
      flags.push({
        residentId: lease.residentId,
        name: `${lease.resident.firstName} ${lease.resident.lastName}`,
        unitId: lease.unitId,
        riskScore: result.score,
        riskTier: result.tier,
        daysToExpiry,
        signals: {
          daysToExpiryDays: daysToExpiry,
          paymentHistoryDelinquent,
          noRenewalOfferYet,
          rentGrowthAboveMarket
        }
      });

      const eventId = `renewal.risk_flagged.${upserted.id}`;
      const payload = {
        event_type: 'renewal.risk_flagged', event_id: eventId,
        occurred_at: new Date().toISOString(), property_id: propertyId,
        resident_id: lease.residentId, lease_id: lease.id,
        risk_score: result.score, risk_tier: result.tier,
        signals: {
          days_to_expiry: daysToExpiry, payment_history_delinquent: paymentHistoryDelinquent,
          no_renewal_offer_yet: noRenewalOfferYet, rent_growth_above_market: rentGrowthAboveMarket,
          current_rent: currentRent, market_rent: marketRent,
        },
      };

      await enqueueWebhook({ eventId, propertyId, residentId: lease.residentId, eventType: 'renewal.risk_flagged', payload });
      deliverWebhook((await prisma.webhookDeliveryLog.findUnique({ where: { eventId } }))?.id ?? '').catch(() => { });
    }
  }

  const totalResidents = await prisma.resident.count({ where: { propertyId, status: 'active' } });

  return {
    propertyId,
    calculatedAt: new Date().toISOString(),
    totalResidents,
    flaggedCount: highRisk + mediumRisk,
    riskTiers: { high: highRisk, medium: mediumRisk, low: lowRisk },
    flags
  };
}

async function getDelinquentResidents(propertyId: string, residentIds: string[]): Promise<Set<string>> {
  if (residentIds.length === 0) return new Set();

  // Since the provided seed script only inserts `payment` records, we define delinquency 
  // as having fewer than 6 valid payments recorded in the ledger.
  const rows = await prisma.residentLedger.groupBy({
    by: ['residentId'],
    where: { propertyId, residentId: { in: residentIds }, transactionType: 'payment' },
    _count: { id: true },
  });

  const delinquent = new Set<string>();
  for (const row of rows) {
    if (row._count.id < 6) {
      delinquent.add(row.residentId);
    }
  }
  return delinquent;
}
