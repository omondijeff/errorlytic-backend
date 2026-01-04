const mongoose = require('mongoose');

const creditExpirationSchema = new mongoose.Schema({
  credits: {
    type: Number,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  purchaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CreditPurchase',
  },
}, { _id: true });

const reservationSchema = new mongoose.Schema({
  credits: {
    type: Number,
    required: true,
  },
  purpose: {
    type: String,
    enum: ['analysis', 'export', 'walkthrough'],
    default: 'analysis',
  },
  reservedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { _id: true });

const creditBalanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  balance: {
    available: {
      type: Number,
      default: 0,
      min: 0,
    },
    pending: {
      type: Number,
      default: 0,
      min: 0,
    },
    lifetime: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  expirations: [creditExpirationSchema],
  reservations: [reservationSchema],
  lastUsedAt: {
    type: Date,
  },
  lastPurchaseAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Virtual for total balance (available + pending)
creditBalanceSchema.virtual('totalBalance').get(function() {
  return this.balance.available + this.balance.pending;
});

// Method to check if user has enough credits
creditBalanceSchema.methods.hasCredits = function(amount = 1) {
  return this.balance.available >= amount;
};

// Method to get non-expired credits
creditBalanceSchema.methods.getValidCredits = function() {
  const now = new Date();
  return this.expirations
    .filter(exp => exp.expiresAt > now)
    .reduce((sum, exp) => sum + exp.credits, 0);
};

// Method to reserve credits for an operation
creditBalanceSchema.methods.reserveCredits = async function(amount, purpose = 'analysis', expirationMinutes = 15) {
  if (this.balance.available < amount) {
    throw new Error('Insufficient credits');
  }

  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

  this.balance.available -= amount;
  this.balance.pending += amount;

  this.reservations.push({
    credits: amount,
    purpose,
    expiresAt,
  });

  await this.save();
  return this.reservations[this.reservations.length - 1];
};

// Method to consume reserved credits (after successful operation)
creditBalanceSchema.methods.consumeReservedCredits = async function(reservationId) {
  const reservationIndex = this.reservations.findIndex(
    r => r._id.toString() === reservationId.toString()
  );

  if (reservationIndex === -1) {
    throw new Error('Reservation not found');
  }

  const reservation = this.reservations[reservationIndex];
  this.balance.pending -= reservation.credits;
  this.reservations.splice(reservationIndex, 1);
  this.lastUsedAt = new Date();

  await this.save();
  return reservation.credits;
};

// Method to release reserved credits (on failure or cancellation)
creditBalanceSchema.methods.releaseReservedCredits = async function(reservationId) {
  const reservationIndex = this.reservations.findIndex(
    r => r._id.toString() === reservationId.toString()
  );

  if (reservationIndex === -1) {
    throw new Error('Reservation not found');
  }

  const reservation = this.reservations[reservationIndex];
  this.balance.available += reservation.credits;
  this.balance.pending -= reservation.credits;
  this.reservations.splice(reservationIndex, 1);

  await this.save();
  return reservation.credits;
};

// Method to add credits from a purchase
creditBalanceSchema.methods.addCredits = async function(amount, purchaseId, expirationDays = 365) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  this.balance.available += amount;
  this.balance.lifetime += amount;
  this.lastPurchaseAt = new Date();

  this.expirations.push({
    credits: amount,
    expiresAt,
    purchaseId,
  });

  await this.save();
};

// Static method to get or create balance for a user
creditBalanceSchema.statics.getOrCreate = async function(userId) {
  let balance = await this.findOne({ userId });
  if (!balance) {
    balance = await this.create({ userId });
  }
  return balance;
};

// Static method to clean up expired reservations
creditBalanceSchema.statics.cleanupExpiredReservations = async function() {
  const now = new Date();
  const balances = await this.find({
    'reservations.expiresAt': { $lt: now }
  });

  for (const balance of balances) {
    const expiredReservations = balance.reservations.filter(
      r => r.expiresAt < now
    );

    for (const reservation of expiredReservations) {
      balance.balance.available += reservation.credits;
      balance.balance.pending -= reservation.credits;
    }

    balance.reservations = balance.reservations.filter(
      r => r.expiresAt >= now
    );

    await balance.save();
  }

  return balances.length;
};

// Index for cleanup queries
creditBalanceSchema.index({ 'reservations.expiresAt': 1 });
creditBalanceSchema.index({ 'expirations.expiresAt': 1 });

module.exports = mongoose.model('CreditBalance', creditBalanceSchema);
