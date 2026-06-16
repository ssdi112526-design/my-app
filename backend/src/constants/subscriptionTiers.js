/**
 * Subscription tier pricing (INR).
 * - Free: ₹150 one-time per connected user
 * - Silver: up to 50 users, ₹5,000/month
 * - Golden: up to 100 users, ₹15,000/month
 * - Platinum: unlimited users (custom billing)
 */

const SUBSCRIPTION_TIERS = {
  free: {
    id: "free",
    name: "Free",
    billingType: "PER_CONNECT",
    perConnectFee: 150,
    monthlyPrice: 0,
    maxUsers: null,
  },
  silver: {
    id: "silver",
    name: "Silver",
    billingType: "MONTHLY_FLAT",
    perConnectFee: 0,
    monthlyPrice: 5000,
    maxUsers: 50,
  },
  golden: {
    id: "golden",
    name: "Golden",
    billingType: "MONTHLY_FLAT",
    perConnectFee: 0,
    monthlyPrice: 15000,
    maxUsers: 100,
  },
  platinum: {
    id: "platinum",
    name: "Platinum",
    billingType: "CUSTOM",
    perConnectFee: 0,
    monthlyPrice: 0,
    maxUsers: null,
  },
};

const TIER_IDS = Object.keys(SUBSCRIPTION_TIERS);

function getTierConfig(tierId) {
  if (!tierId) return SUBSCRIPTION_TIERS.free;
  return SUBSCRIPTION_TIERS[tierId] || SUBSCRIPTION_TIERS.free;
}

module.exports = {
  SUBSCRIPTION_TIERS,
  TIER_IDS,
  getTierConfig,
};
