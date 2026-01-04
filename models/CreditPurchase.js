const mongoose = require('mongoose');

const creditPurchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  pack: {
    type: {
      type: String,
      enum: ['small', 'medium', 'large', 'custom'],
      required: true,
    },
    credits: {
      type: Number,
      required: true,
      min: 1,
    },
    name: {
      type: String,
      required: true,
    },
  },
  pricing: {
    basePrice: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    promoCode: {
      type: String,
    },
    promoDiscount: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      enum: ['KES', 'USD'],
      required: true,
    },
  },
  payment: {
    provider: {
      type: String,
      enum: ['paystack', 'mpesa', 'manual', 'promo'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    reference: {
      type: String,
      index: true,
    },
    providerReference: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
    // Paystack-specific fields
    paystack: {
      authorizationCode: String,
      transactionId: String,
      channel: String,
      cardType: String,
      last4: String,
      bank: String,
    },
    // M-Pesa-specific fields
    mpesa: {
      checkoutRequestId: String,
      merchantRequestId: String,
      phoneNumber: String,
      mpesaReceiptNumber: String,
      transactionDate: String,
    },
  },
  creditsDelivered: {
    type: Boolean,
    default: false,
  },
  deliveredAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api', 'admin'],
      default: 'web',
    },
  },
}, {
  timestamps: true,
});

// Generate unique reference
creditPurchaseSchema.pre('save', function(next) {
  if (!this.payment.reference) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    this.payment.reference = `CPR-${timestamp}-${random}`.toUpperCase();
  }
  next();
});

// Method to mark payment as completed and deliver credits
creditPurchaseSchema.methods.completePayment = async function(providerData = {}) {
  this.payment.status = 'completed';
  this.payment.paidAt = new Date();

  if (providerData.paystack) {
    this.payment.paystack = providerData.paystack;
    this.payment.providerReference = providerData.paystack.transactionId;
  }

  if (providerData.mpesa) {
    this.payment.mpesa = providerData.mpesa;
    this.payment.providerReference = providerData.mpesa.mpesaReceiptNumber;
  }

  await this.save();
};

// Method to deliver credits to user
creditPurchaseSchema.methods.deliverCredits = async function() {
  if (this.creditsDelivered) {
    throw new Error('Credits already delivered');
  }

  if (this.payment.status !== 'completed') {
    throw new Error('Payment not completed');
  }

  const CreditBalance = mongoose.model('CreditBalance');
  const balance = await CreditBalance.getOrCreate(this.userId);

  // Credits expire in 365 days by default
  const expirationDays = 365;
  await balance.addCredits(this.pack.credits, this._id, expirationDays);

  this.creditsDelivered = true;
  this.deliveredAt = new Date();
  this.expiresAt = new Date();
  this.expiresAt.setDate(this.expiresAt.getDate() + expirationDays);

  await this.save();

  return balance;
};

// Method to mark payment as failed
creditPurchaseSchema.methods.failPayment = async function(reason) {
  this.payment.status = 'failed';
  this.metadata.failureReason = reason;
  await this.save();
};

// Static method to get user purchase history
creditPurchaseSchema.statics.getUserHistory = async function(userId, options = {}) {
  const { page = 1, limit = 10, status } = options;

  const query = { userId };
  if (status) query['payment.status'] = status;

  const purchases = await this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await this.countDocuments(query);

  return {
    purchases,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

// Static method to get revenue statistics
creditPurchaseSchema.statics.getRevenueStats = async function(startDate, endDate) {
  const match = {
    'payment.status': 'completed',
    'payment.paidAt': {
      $gte: startDate,
      $lte: endDate,
    },
  };

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          currency: '$pricing.currency',
          packType: '$pack.type',
        },
        totalRevenue: { $sum: '$pricing.total' },
        totalCredits: { $sum: '$pack.credits' },
        count: { $sum: 1 },
      },
    },
  ]);

  return stats;
};

// Indexes
creditPurchaseSchema.index({ 'payment.status': 1, createdAt: -1 });
creditPurchaseSchema.index({ 'payment.paidAt': 1 });
creditPurchaseSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CreditPurchase', creditPurchaseSchema);
