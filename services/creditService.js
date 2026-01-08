const CreditBalance = require('../models/CreditBalance');
const CreditPurchase = require('../models/CreditPurchase');
const PricingConfig = require('../models/PricingConfig');
const User = require('../models/User');
const paystackService = require('./paystackService');
const mpesaService = require('./mpesaService');

class CreditService {
  /**
   * Get available credit packs from active pricing config
   */
  async getCreditPacks() {
    const config = await PricingConfig.getActive();
    return config.individual.creditPacks.filter(pack => pack.enabled);
  }

  /**
   * Get user's credit balance
   * @param {string} userId - User ID
   */
  async getBalance(userId) {
    const balance = await CreditBalance.getOrCreate(userId);
    const validCredits = balance.getValidCredits();

    return {
      available: balance.balance.available,
      pending: balance.balance.pending,
      lifetime: balance.balance.lifetime,
      validCredits,
      lastUsedAt: balance.lastUsedAt,
      lastPurchaseAt: balance.lastPurchaseAt,
    };
  }

  /**
   * Check if user has enough credits
   * @param {string} userId - User ID
   * @param {number} amount - Credits needed
   */
  async hasCredits(userId, amount = 1) {
    const balance = await CreditBalance.getOrCreate(userId);
    return balance.hasCredits(amount);
  }

  /**
   * Reserve credits for an operation
   * @param {string} userId - User ID
   * @param {number} amount - Credits to reserve
   * @param {string} purpose - Purpose of reservation
   */
  async reserveCredits(userId, amount = 1, purpose = 'analysis') {
    const balance = await CreditBalance.getOrCreate(userId);

    if (!balance.hasCredits(amount)) {
      throw new Error(`Insufficient credits. You have ${balance.balance.available} credits but need ${amount}.`);
    }

    const reservation = await balance.reserveCredits(amount, purpose);

    return {
      reservationId: reservation._id,
      creditsReserved: amount,
      remainingAvailable: balance.balance.available,
    };
  }

  /**
   * Consume reserved credits after successful operation
   * @param {string} userId - User ID
   * @param {string} reservationId - Reservation ID
   */
  async consumeCredits(userId, reservationId) {
    const balance = await CreditBalance.findOne({ userId });

    if (!balance) {
      throw new Error('Credit balance not found');
    }

    const creditsConsumed = await balance.consumeReservedCredits(reservationId);

    return {
      creditsConsumed,
      remainingAvailable: balance.balance.available,
    };
  }

  /**
   * Release reserved credits on failure
   * @param {string} userId - User ID
   * @param {string} reservationId - Reservation ID
   */
  async releaseCredits(userId, reservationId) {
    const balance = await CreditBalance.findOne({ userId });

    if (!balance) {
      throw new Error('Credit balance not found');
    }

    const creditsReleased = await balance.releaseReservedCredits(reservationId);

    return {
      creditsReleased,
      availableBalance: balance.balance.available,
    };
  }

  /**
   * Initialize a credit pack purchase
   * @param {Object} params - Purchase parameters
   */
  async initializePurchase({
    userId,
    packType,
    paymentMethod,
    currency = 'KES',
    promoCode,
    callbackUrl,
    phoneNumber, // For M-Pesa
    metadata = {},
  }) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get pricing config
    const config = await PricingConfig.getActive();
    const pack = config.individual.creditPacks.find(p => p.type === packType && p.enabled);

    if (!pack) {
      throw new Error(`Credit pack "${packType}" not found or disabled`);
    }

    // Calculate pricing
    let basePrice = pack.pricing[currency];
    let discount = pack.discount || 0;
    let promoDiscount = 0;
    let promoCodeUsed = null;

    // Validate promo code if provided
    if (promoCode) {
      const promoResult = config.validatePromoCode(promoCode, 'credits', currency, basePrice);
      if (promoResult.valid) {
        promoDiscount = promoResult.discount;
        promoCodeUsed = promoCode.toUpperCase();
      }
    }

    const total = basePrice - (basePrice * discount / 100) - promoDiscount;

    // Create purchase record
    const purchase = new CreditPurchase({
      userId,
      pack: {
        type: pack.type,
        credits: pack.credits,
        name: pack.name,
      },
      pricing: {
        basePrice,
        discount,
        promoCode: promoCodeUsed,
        promoDiscount,
        total: Math.max(0, total),
        currency,
      },
      payment: {
        provider: paymentMethod,
        status: 'pending',
      },
      metadata: {
        ...metadata,
        source: metadata.source || 'web',
      },
    });

    await purchase.save();

    // Initialize payment based on method
    let paymentResult;

    if (paymentMethod === 'paystack') {
      paymentResult = await paystackService.initializeTransaction({
        email: user.email,
        amount: purchase.pricing.total,
        currency,
        reference: purchase.payment.reference,
        callbackUrl,
        metadata: {
          purchaseId: purchase._id.toString(),
          userId: userId,
          type: 'credit_purchase',
          packType,
          credits: pack.credits,
        },
      });

      if (!paymentResult.success) {
        purchase.payment.status = 'failed';
        await purchase.save();
        throw new Error(paymentResult.error);
      }

      return {
        purchaseId: purchase._id,
        reference: purchase.payment.reference,
        paymentUrl: paymentResult.data.authorizationUrl,
        amount: purchase.pricing.total,
        currency,
        credits: pack.credits,
      };
    }

    if (paymentMethod === 'mpesa') {
      if (!phoneNumber) {
        throw new Error('Phone number required for M-Pesa payment');
      }

      paymentResult = await mpesaService.initiateSTKPush({
        phoneNumber,
        amount: purchase.pricing.total,
        accountReference: purchase.payment.reference.substring(0, 12),
        transactionDesc: `${pack.credits} Credits`,
      });

      if (!paymentResult.success) {
        purchase.payment.status = 'failed';
        await purchase.save();
        throw new Error(paymentResult.error);
      }

      // Store M-Pesa specific data
      purchase.payment.mpesa = {
        checkoutRequestId: paymentResult.data.checkoutRequestId,
        merchantRequestId: paymentResult.data.merchantRequestId,
        phoneNumber: paymentResult.data.phoneNumber,
        accountReference: paymentResult.data.accountReference,
      };
      await purchase.save();

      return {
        purchaseId: purchase._id,
        reference: purchase.payment.reference,
        checkoutRequestId: paymentResult.data.checkoutRequestId,
        amount: purchase.pricing.total,
        currency,
        credits: pack.credits,
        customerMessage: paymentResult.data.customerMessage,
      };
    }

    throw new Error(`Unsupported payment method: ${paymentMethod}`);
  }

  /**
   * Verify and complete a Paystack payment
   * @param {string} reference - Payment reference
   */
  async verifyPaystackPayment(reference) {
    const purchase = await CreditPurchase.findOne({ 'payment.reference': reference });

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    if (purchase.payment.status === 'completed' && purchase.creditsDelivered) {
      return {
        success: true,
        alreadyProcessed: true,
        message: 'Payment already processed',
        credits: purchase.pack.credits,
      };
    }

    // Verify with Paystack
    const verifyResult = await paystackService.verifyTransaction(reference);

    if (!verifyResult.success) {
      throw new Error(verifyResult.error);
    }

    const { data } = verifyResult;

    if (data.status !== 'success') {
      purchase.payment.status = 'failed';
      await purchase.save();
      throw new Error(`Payment ${data.status}: verification failed`);
    }

    // Complete payment
    await purchase.completePayment({
      paystack: {
        transactionId: data.transactionId,
        authorizationCode: data.authorization?.authorizationCode,
        channel: data.channel,
        cardType: data.authorization?.cardType,
        last4: data.authorization?.last4,
        bank: data.authorization?.bank,
      },
    });

    // Deliver credits
    const balance = await purchase.deliverCredits();

    // Update user's Paystack authorization for future charges
    if (data.authorization?.reusable) {
      await User.findByIdAndUpdate(purchase.userId, {
        'billing.paystackCustomerId': data.customer.id,
        'billing.paystackAuthorizationCode': data.authorization.authorizationCode,
      });
    }

    return {
      success: true,
      credits: purchase.pack.credits,
      newBalance: balance.balance.available,
      transactionId: data.transactionId,
    };
  }

  /**
   * Process M-Pesa callback
   * @param {Object} callbackData - M-Pesa callback data
   */
  async processMpesaCallback(callbackData) {
    const result = mpesaService.processSTKCallback(callbackData);

    if (!result.success) {
      console.error('M-Pesa callback processing error:', result.error);
      return { success: false, error: result.error };
    }

    const { checkoutRequestId } = result.data;

    // Find the purchase
    const purchase = await CreditPurchase.findOne({
      'payment.mpesa.checkoutRequestId': checkoutRequestId,
    });

    if (!purchase) {
      console.error('Purchase not found for checkout:', checkoutRequestId);
      return { success: false, error: 'Purchase not found' };
    }

    if (result.status === 'completed') {
      // Complete payment
      await purchase.completePayment({
        mpesa: {
          mpesaReceiptNumber: result.data.mpesaReceiptNumber,
          transactionDate: result.data.transactionDate,
          phoneNumber: result.data.phoneNumber,
        },
      });

      // Deliver credits
      const balance = await purchase.deliverCredits();

      return {
        success: true,
        status: 'completed',
        credits: purchase.pack.credits,
        newBalance: balance.balance.available,
        mpesaReceipt: result.data.mpesaReceiptNumber,
      };
    } else {
      // Payment failed or cancelled
      purchase.payment.status = result.status === 'cancelled' ? 'failed' : 'failed';
      purchase.metadata.failureReason = result.data.resultDescription;
      await purchase.save();

      return {
        success: true,
        status: result.status,
        message: result.data.resultDescription,
      };
    }
  }

  /**
   * Check M-Pesa payment status
   * @param {string} checkoutRequestId - M-Pesa checkout request ID
   */
  async checkMpesaStatus(checkoutRequestId) {
    const purchase = await CreditPurchase.findOne({
      'payment.mpesa.checkoutRequestId': checkoutRequestId,
    });

    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // If already completed, return early
    if (purchase.payment.status === 'completed') {
      return {
        status: 'completed',
        credits: purchase.pack.credits,
        mpesaReceipt: purchase.payment.mpesa?.mpesaReceiptNumber,
      };
    }

    // Query M-Pesa for status
    const statusResult = await mpesaService.querySTKStatus(checkoutRequestId);

    if (!statusResult.success) {
      return {
        status: 'pending',
        message: 'Waiting for payment confirmation',
      };
    }

    if (statusResult.status === 'completed' && purchase.payment.status !== 'completed') {
      // Payment completed - deliver credits
      await purchase.completePayment({
        mpesa: purchase.payment.mpesa,
      });
      const balance = await purchase.deliverCredits();

      return {
        status: 'completed',
        credits: purchase.pack.credits,
        newBalance: balance.balance.available,
      };
    }

    return {
      status: statusResult.status,
      message: statusResult.data?.resultDescription || 'Payment is being processed',
    };
  }

  /**
   * Get user's purchase history
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   */
  async getPurchaseHistory(userId, options = {}) {
    return CreditPurchase.getUserHistory(userId, options);
  }

  /**
   * Get credit usage history
   * @param {string} userId - User ID
   */
  async getUsageHistory(userId) {
    const balance = await CreditBalance.findOne({ userId });

    if (!balance) {
      return { expirations: [], reservations: [] };
    }

    return {
      expirations: balance.expirations,
      reservations: balance.reservations,
    };
  }

  /**
   * Add complimentary credits (admin function)
   * @param {string} userId - User ID
   * @param {number} credits - Number of credits to add
   * @param {string} reason - Reason for adding credits
   * @param {Object} adminUser - Admin user who is adding the credits
   */
  async addComplimentaryCredits(userId, credits, reason = 'Complimentary', adminUser = null) {
    const balance = await CreditBalance.getOrCreate(userId);
    const targetUser = await User.findById(userId);

    // Determine rate based on user type
    const isOrganizationUser = targetUser && ['garage_admin', 'garage_user', 'insurer_admin', 'insurer_user'].includes(targetUser.role);
    const ratePerCredit = isOrganizationUser ? 200 : 100; // KES
    const totalValue = credits * ratePerCredit;

    // Create a purchase record for audit trail
    const purchase = await CreditPurchase.create({
      userId,
      pack: {
        type: 'custom',
        credits,
        name: `Complimentary: ${reason}`,
      },
      pricing: {
        basePrice: totalValue,
        discount: 100, // 100% discount since it's complimentary
        promoDiscount: 0,
        total: 0, // No actual charge
        currency: 'KES',
      },
      payment: {
        provider: 'manual',
        status: 'completed',
        paidAt: new Date(),
      },
      creditsDelivered: false,
      metadata: {
        source: 'admin',
        addedBy: adminUser?._id || adminUser?.id,
        addedByEmail: adminUser?.email,
        reason: reason,
      },
    });

    console.log(`[CREDIT AUDIT] Admin ${adminUser?.email || 'unknown'} added ${credits} credits (value: KES ${totalValue}) to user ${targetUser?.email || userId}. Reason: ${reason}`);

    // Add credits
    await balance.addCredits(credits, purchase._id, 365);
    purchase.creditsDelivered = true;
    purchase.deliveredAt = new Date();
    await purchase.save();

    return {
      success: true,
      credits,
      newBalance: balance.balance.available,
    };
  }

  /**
   * Cleanup expired reservations (should run periodically)
   */
  async cleanupExpiredReservations() {
    const count = await CreditBalance.cleanupExpiredReservations();
    return { cleanedUp: count };
  }
}

module.exports = new CreditService();
