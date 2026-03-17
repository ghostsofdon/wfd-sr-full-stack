/**
 * Risk Scoring Service — pure functions, no DB dependency.
 * Unit testable in isolation.
 */

export interface RiskInputs {
  daysToExpiry: number;
  paymentHistoryDelinquent: boolean;
  noRenewalOfferYet: boolean;
  rentGrowthAboveMarket: boolean;
  currentRent: number;
  marketRent: number | null;
}

export interface RiskResult {
  score: number;
  tier: 'high' | 'medium' | 'low';
  components: {
    daysToExpiryPoints: number;
    paymentDelinquentPoints: number;
    noRenewalOfferPoints: number;
    rentGrowthPoints: number;
  };
}

/**
 * Map days-to-expiry to point contribution.
 * ≤30d = 40, 31-60d = 30, 61-90d = 20, >90d = 0
 */
function daysToExpiryPoints(days: number): number {
  if (days <= 30) return 40;
  if (days <= 60) return 30;
  if (days <= 90) return 20;
  return 0;
}

/**
 * Calculate the rent growth signal.
 * Returns true if market_rent > current_rent * 1.05
 */
export function calcRentGrowthAboveMarket(
  currentRent: number,
  marketRent: number | null
): boolean {
  if (marketRent === null) return false;
  return marketRent > currentRent * 1.05;
}

/**
 * Core scoring function.
 * Pure — no side effects, no DB calls.
 */
export function calculateRiskScore(inputs: RiskInputs): RiskResult {
  const daysPoints = daysToExpiryPoints(inputs.daysToExpiry);
  const paymentPoints = inputs.paymentHistoryDelinquent ? 25 : 0;
  const offerPoints = inputs.noRenewalOfferYet ? 20 : 0;
  const rentPoints = inputs.rentGrowthAboveMarket ? 15 : 0;

  const score = daysPoints + paymentPoints + offerPoints + rentPoints;

  let tier: 'high' | 'medium' | 'low';
  if (score >= 70) tier = 'high';
  else if (score >= 40) tier = 'medium';
  else tier = 'low';

  return {
    score,
    tier,
    components: {
      daysToExpiryPoints: daysPoints,
      paymentDelinquentPoints: paymentPoints,
      noRenewalOfferPoints: offerPoints,
      rentGrowthPoints: rentPoints,
    },
  };
}
