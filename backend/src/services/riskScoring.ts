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
  // 1. Days to Expiry Risk (0-100)
  let daysRisk = 0;
  if (inputs.daysToExpiry < 0) daysRisk = 100; // MTM or expired
  else if (inputs.daysToExpiry <= 30) daysRisk = 100;
  else if (inputs.daysToExpiry <= 45) daysRisk = 90;
  else if (inputs.daysToExpiry <= 60) daysRisk = 70;
  else if (inputs.daysToExpiry <= 90) daysRisk = 30;
  else daysRisk = 0;

  // 2. Payment Delinquency Risk (0-100)
  const delinqRisk = inputs.paymentHistoryDelinquent ? 100 : 0;

  // 3. No Renewal Offer (0-100)
  const offerRisk = inputs.noRenewalOfferYet ? 100 : 0;

  // 4. Rent Growth (0-100)
  let rentRisk = 0;
  if (inputs.marketRent !== null && inputs.currentRent > 0) {
    if (inputs.marketRent > inputs.currentRent * 1.05) rentRisk = 100;
  }

  // Weighted sum exactly as outlined in renewal_risk_takehome.md
  // 40% Days, 25% Delinquent, 20% Offer, 15% Rent
  const daysComponent = daysRisk * 0.40;
  const paymentComponent = delinqRisk * 0.25;
  const offerComponent = offerRisk * 0.20;
  const rentComponent = rentRisk * 0.15;

  const score = Math.round(daysComponent + paymentComponent + offerComponent + rentComponent);

  let tier: 'high' | 'medium' | 'low';
  if (score >= 70) tier = 'high';
  else if (score >= 40) tier = 'medium';
  else tier = 'low';

  return {
    score,
    tier,
    components: {
      daysToExpiryPoints: daysComponent,
      paymentDelinquentPoints: paymentComponent,
      noRenewalOfferPoints: offerComponent,
      rentGrowthPoints: rentComponent,
    },
  };
}
