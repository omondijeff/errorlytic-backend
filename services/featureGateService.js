const User = require('../models/User');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const CreditBalance = require('../models/CreditBalance');
const PricingConfig = require('../models/PricingConfig');

class FeatureGateService {
  /**
   * Determine user's billing context
   * @param {string} userId - User ID
   */
  async getUserBillingContext(userId) {
    const user = await User.findById(userId).populate('orgId');

    if (!user) {
      throw new Error('User not found');
    }

    const context = {
      userId: user._id,
      accountType: user.accountType || 'individual',
      role: user.role,
      featureFlags: user.featureFlags || {},
    };

    // Check if user belongs to an organization
    if (user.orgId) {
      const org = user.orgId;
      context.organizationId = org._id;
      context.organizationType = org.type;
      context.organizationName = org.name;

      // Get organization's subscription
      const subscription = await Subscription.findOne({
        orgId: org._id,
        status: 'active',
      });

      if (subscription) {
        context.subscription = {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          includedAnalyses: subscription.includedAnalyses || 100,
          usedAnalyses: subscription.usedAnalyses || 0,
          remainingAnalyses: subscription.plan === 'enterprise'
            ? Infinity
            : Math.max(0, (subscription.includedAnalyses || 100) - (subscription.usedAnalyses || 0)),
        };
      }
    } else {
      // Individual user - check credit balance
      const balance = await CreditBalance.findOne({ userId });
      context.credits = {
        available: balance?.balance?.available || 0,
        pending: balance?.balance?.pending || 0,
      };
    }

    return context;
  }

  /**
   * Check if user can access a specific feature
   * @param {string} userId - User ID
   * @param {string} featureKey - Feature key to check
   */
  async canAccessFeature(userId, featureKey) {
    const context = await this.getUserBillingContext(userId);
    const config = await PricingConfig.getActive();

    // Superadmins have access to everything
    if (context.role === 'superadmin') {
      return {
        allowed: true,
        reason: 'Superadmin access',
      };
    }

    // Check user's feature flags first (allows manual overrides)
    if (context.featureFlags && context.featureFlags[featureKey] !== undefined) {
      return {
        allowed: context.featureFlags[featureKey],
        reason: context.featureFlags[featureKey] ? 'Feature enabled for user' : 'Feature disabled for user',
      };
    }

    // Get feature configuration
    const feature = config.features.find(f => f.key === featureKey);

    if (!feature) {
      // Unknown feature - default to allowed for basic features
      return {
        allowed: true,
        reason: 'Feature not gated',
      };
    }

    // Check based on user type and subscription
    if (context.subscription) {
      // Organization user with subscription
      const plan = context.subscription.plan;
      const hasAccess = feature.availableTo[plan] || false;

      return {
        allowed: hasAccess,
        reason: hasAccess
          ? `Feature available in ${plan} plan`
          : `Feature requires higher plan (available in: ${this.getPlansWithFeature(feature)})`,
        plan,
      };
    } else {
      // Individual user
      const hasAccess = feature.availableTo.individual || false;

      return {
        allowed: hasAccess,
        reason: hasAccess
          ? 'Feature available for individuals'
          : 'Feature requires organization subscription',
      };
    }
  }

  /**
   * Check if user can perform an analysis
   * @param {string} userId - User ID
   */
  async canPerformAnalysis(userId) {
    const context = await this.getUserBillingContext(userId);

    // Superadmins can always perform analysis
    if (context.role === 'superadmin') {
      return {
        allowed: true,
        reason: 'Superadmin access',
        analysisType: 'full',
      };
    }

    if (context.subscription) {
      // Organization with subscription
      const { subscription } = context;

      // Enterprise plan has unlimited analyses
      if (subscription.plan === 'enterprise') {
        return {
          allowed: true,
          reason: 'Unlimited analyses with Enterprise plan',
          analysisType: 'full',
          remaining: Infinity,
        };
      }

      // Pro plan - check usage
      if (subscription.remainingAnalyses > 0) {
        return {
          allowed: true,
          reason: `${subscription.remainingAnalyses} analyses remaining this period`,
          analysisType: 'full',
          remaining: subscription.remainingAnalyses,
        };
      }

      // Out of included analyses - check if overage is allowed
      return {
        allowed: false,
        reason: 'Monthly analysis limit reached. Upgrade to Enterprise for unlimited analyses.',
        analysisType: null,
        remaining: 0,
        upgrade: {
          message: 'Contact support to enable overage billing or upgrade to Enterprise',
          plan: 'enterprise',
        },
      };
    } else {
      // Individual user - check credits
      const { credits } = context;

      if (credits.available > 0) {
        return {
          allowed: true,
          reason: `${credits.available} credits available`,
          analysisType: 'basic', // Individuals get basic analysis only
          remaining: credits.available,
        };
      }

      return {
        allowed: false,
        reason: 'Insufficient credits. Purchase credits to continue.',
        analysisType: null,
        remaining: 0,
        purchase: {
          message: 'Purchase credits to perform analyses',
          url: '/credits/purchase',
        },
      };
    }
  }

  /**
   * Get the analysis type available for user
   * @param {string} userId - User ID
   */
  async getAnalysisType(userId) {
    const context = await this.getUserBillingContext(userId);

    // Superadmins get full analysis
    if (context.role === 'superadmin') {
      return 'full';
    }

    // Organization users with active subscription get full analysis
    if (context.subscription && context.subscription.status === 'active') {
      return 'full';
    }

    // Individual users get basic analysis only
    return 'basic';
  }

  /**
   * Get all features with their availability for a user
   * @param {string} userId - User ID
   */
  async getAllFeatureAccess(userId) {
    const config = await PricingConfig.getActive();
    const context = await this.getUserBillingContext(userId);

    const features = {};

    for (const feature of config.features) {
      const access = await this.canAccessFeature(userId, feature.key);
      features[feature.key] = {
        name: feature.name,
        description: feature.description,
        ...access,
      };
    }

    return {
      accountType: context.accountType,
      plan: context.subscription?.plan || 'individual',
      features,
    };
  }

  /**
   * Record analysis usage for organization
   * @param {string} orgId - Organization ID
   */
  async recordOrganizationUsage(orgId) {
    const subscription = await Subscription.findOne({
      orgId,
      status: 'active',
    });

    if (subscription && subscription.plan !== 'enterprise') {
      subscription.usedAnalyses = (subscription.usedAnalyses || 0) + 1;
      await subscription.save();

      return {
        used: subscription.usedAnalyses,
        included: subscription.includedAnalyses,
        remaining: Math.max(0, subscription.includedAnalyses - subscription.usedAnalyses),
      };
    }

    return null;
  }

  /**
   * Get plans that have a specific feature
   * @param {Object} feature - Feature object
   */
  getPlansWithFeature(feature) {
    const plans = [];
    if (feature.availableTo.individual) plans.push('Individual');
    if (feature.availableTo.pro) plans.push('Pro');
    if (feature.availableTo.enterprise) plans.push('Enterprise');
    return plans.join(', ');
  }

  /**
   * Middleware to check feature access
   * @param {string} featureKey - Feature to check
   */
  requireFeature(featureKey) {
    return async (req, res, next) => {
      try {
        const userId = req.user._id;
        const access = await this.canAccessFeature(userId, featureKey);

        if (!access.allowed) {
          return res.status(403).json({
            success: false,
            error: 'Feature not available',
            message: access.reason,
            feature: featureKey,
          });
        }

        req.featureAccess = access;
        next();
      } catch (error) {
        console.error('Feature gate error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check feature access',
        });
      }
    };
  }

  /**
   * Middleware to check if user can perform analysis
   */
  requireAnalysisPermission() {
    return async (req, res, next) => {
      try {
        const userId = req.user._id;
        const permission = await this.canPerformAnalysis(userId);

        if (!permission.allowed) {
          return res.status(403).json({
            success: false,
            error: 'Analysis not permitted',
            message: permission.reason,
            ...(permission.purchase && { purchase: permission.purchase }),
            ...(permission.upgrade && { upgrade: permission.upgrade }),
          });
        }

        req.analysisPermission = permission;
        next();
      } catch (error) {
        console.error('Analysis permission error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to check analysis permission',
        });
      }
    };
  }
}

module.exports = new FeatureGateService();
