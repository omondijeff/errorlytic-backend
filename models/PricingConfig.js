const mongoose = require('mongoose');

const creditPackSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['small', 'medium', 'large'],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  credits: {
    type: Number,
    required: true,
    min: 1,
  },
  pricing: {
    KES: {
      type: Number,
      required: true,
    },
    USD: {
      type: Number,
      required: true,
    },
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  popular: {
    type: Boolean,
    default: false,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
}, { _id: false });

const organizationPlanSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pro', 'enterprise'],
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  pricing: {
    monthly: {
      KES: Number,
      USD: Number,
    },
    yearly: {
      KES: Number,
      USD: Number,
    },
  },
  includedAnalyses: {
    type: Number,
    default: 0, // 0 means unlimited
  },
  overageRate: {
    KES: Number,
    USD: Number,
  },
  features: [{
    type: String,
  }],
  enabled: {
    type: Boolean,
    default: true,
  },
}, { _id: false });

const promoCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    uppercase: true,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true,
  },
  discountValue: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    enum: ['KES', 'USD', 'ALL'],
    default: 'ALL',
  },
  applicableTo: {
    type: String,
    enum: ['credits', 'subscription', 'all'],
    default: 'all',
  },
  minPurchase: {
    KES: Number,
    USD: Number,
  },
  maxDiscount: {
    KES: Number,
    USD: Number,
  },
  usageLimit: {
    type: Number,
    default: 0, // 0 means unlimited
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  validFrom: {
    type: Date,
    default: Date.now,
  },
  validUntil: {
    type: Date,
  },
  enabled: {
    type: Boolean,
    default: true,
  },
});

const featureConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  key: {
    type: String,
    required: true,
  },
  description: String,
  availableTo: {
    individual: {
      type: Boolean,
      default: false,
    },
    pro: {
      type: Boolean,
      default: false,
    },
    enterprise: {
      type: Boolean,
      default: true,
    },
  },
}, { _id: false });

const pricingConfigSchema = new mongoose.Schema({
  version: {
    type: Number,
    required: true,
    default: 1,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  individual: {
    creditPacks: [creditPackSchema],
    perAnalysisCost: {
      KES: {
        type: Number,
        default: 100,
      },
      USD: {
        type: Number,
        default: 0.75,
      },
    },
  },
  organization: {
    plans: [organizationPlanSchema],
    perAnalysisCost: {
      KES: {
        type: Number,
        default: 50,
      },
      USD: {
        type: Number,
        default: 0.35,
      },
    },
  },
  promoCodes: [promoCodeSchema],
  features: [featureConfigSchema],
  exchangeRate: {
    KESUSD: {
      type: Number,
      default: 133, // 1 USD = 133 KES
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Static method to get active pricing config
pricingConfigSchema.statics.getActive = async function() {
  let config = await this.findOne({ isActive: true }).sort({ version: -1 });

  if (!config) {
    // Create default config if none exists
    config = await this.createDefault();
  }

  return config;
};

// Static method to create default pricing config
pricingConfigSchema.statics.createDefault = async function() {
  const defaultConfig = {
    version: 1,
    isActive: true,
    individual: {
      creditPacks: [
        {
          type: 'small',
          name: 'Starter Pack',
          credits: 5,
          pricing: { KES: 500, USD: 3.75 },
          discount: 0,
          popular: false,
          enabled: true,
        },
        {
          type: 'medium',
          name: 'Standard Pack',
          credits: 20,
          pricing: { KES: 1800, USD: 13.50 },
          discount: 10,
          popular: true,
          enabled: true,
        },
        {
          type: 'large',
          name: 'Professional Pack',
          credits: 50,
          pricing: { KES: 4000, USD: 30.00 },
          discount: 20,
          popular: false,
          enabled: true,
        },
      ],
      perAnalysisCost: { KES: 100, USD: 0.75 },
    },
    organization: {
      plans: [
        {
          type: 'pro',
          name: 'Pro Plan',
          description: 'For growing garages and insurance teams',
          pricing: {
            monthly: { KES: 7500, USD: 50 },
            yearly: { KES: 75000, USD: 500 },
          },
          includedAnalyses: 100,
          overageRate: { KES: 50, USD: 0.35 },
          features: [
            'ai_insights',
            'pdf_export',
            'walkthrough',
            'quotations',
            'team_access',
            'email_support',
          ],
          enabled: true,
        },
        {
          type: 'enterprise',
          name: 'Enterprise Plan',
          description: 'For large organizations with unlimited needs',
          pricing: {
            monthly: { KES: 97500, USD: 650 },
            yearly: { KES: 975000, USD: 6500 },
          },
          includedAnalyses: 0, // Unlimited
          overageRate: { KES: 0, USD: 0 },
          features: [
            'ai_insights',
            'pdf_export',
            'walkthrough',
            'quotations',
            'team_access',
            'fraud_detection',
            'priority_support',
            'api_access',
            'custom_branding',
            'sla_guarantee',
          ],
          enabled: true,
        },
      ],
      perAnalysisCost: { KES: 50, USD: 0.35 },
    },
    features: [
      {
        name: 'Basic Analysis',
        key: 'basic_analysis',
        description: 'Parse and display VCDS diagnostic data',
        availableTo: { individual: true, pro: true, enterprise: true },
      },
      {
        name: 'AI Insights',
        key: 'ai_insights',
        description: 'AI-powered diagnostic interpretation',
        availableTo: { individual: false, pro: true, enterprise: true },
      },
      {
        name: 'PDF Export',
        key: 'pdf_export',
        description: 'Export reports as professional PDFs',
        availableTo: { individual: false, pro: true, enterprise: true },
      },
      {
        name: 'Video Walkthrough',
        key: 'walkthrough',
        description: 'Generate video explanations of diagnostics',
        availableTo: { individual: false, pro: true, enterprise: true },
      },
      {
        name: 'Quotations',
        key: 'quotations',
        description: 'Generate repair cost quotations',
        availableTo: { individual: false, pro: true, enterprise: true },
      },
      {
        name: 'Fraud Detection',
        key: 'fraud_detection',
        description: 'Detect potential mileage/diagnostic tampering',
        availableTo: { individual: false, pro: false, enterprise: true },
      },
      {
        name: 'Priority Support',
        key: 'priority_support',
        description: '24/7 priority customer support',
        availableTo: { individual: false, pro: false, enterprise: true },
      },
      {
        name: 'API Access',
        key: 'api_access',
        description: 'Direct API access for integrations',
        availableTo: { individual: false, pro: false, enterprise: true },
      },
    ],
    promoCodes: [],
    exchangeRate: {
      KESUSD: 133,
      lastUpdated: new Date(),
    },
  };

  return await this.create(defaultConfig);
};

// Method to validate promo code
pricingConfigSchema.methods.validatePromoCode = function(code, purchaseType, currency, amount) {
  const promo = this.promoCodes.find(
    p => p.code === code.toUpperCase() && p.enabled
  );

  if (!promo) {
    return { valid: false, error: 'Invalid promo code' };
  }

  const now = new Date();
  if (promo.validUntil && promo.validUntil < now) {
    return { valid: false, error: 'Promo code has expired' };
  }

  if (promo.validFrom > now) {
    return { valid: false, error: 'Promo code is not yet active' };
  }

  if (promo.usageLimit > 0 && promo.usedCount >= promo.usageLimit) {
    return { valid: false, error: 'Promo code usage limit reached' };
  }

  if (promo.applicableTo !== 'all' && promo.applicableTo !== purchaseType) {
    return { valid: false, error: `Promo code not applicable to ${purchaseType}` };
  }

  if (promo.currency !== 'ALL' && promo.currency !== currency) {
    return { valid: false, error: `Promo code not valid for ${currency}` };
  }

  if (promo.minPurchase && promo.minPurchase[currency] > amount) {
    return { valid: false, error: `Minimum purchase of ${promo.minPurchase[currency]} ${currency} required` };
  }

  // Calculate discount
  let discount;
  if (promo.discountType === 'percentage') {
    discount = (amount * promo.discountValue) / 100;
    if (promo.maxDiscount && promo.maxDiscount[currency]) {
      discount = Math.min(discount, promo.maxDiscount[currency]);
    }
  } else {
    discount = promo.discountValue;
  }

  return {
    valid: true,
    promo,
    discount,
    finalAmount: amount - discount,
  };
};

// Index for active config lookup
pricingConfigSchema.index({ isActive: 1, version: -1 });

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
