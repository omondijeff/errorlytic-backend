const mongoose = require("mongoose");

const dtcLibrarySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    modules: [
      {
        type: String,
        enum: [
          "Engine",
          "Transmission",
          "ABS",
          "Airbag",
          "Infotainment",
          "Other",
        ],
        required: true,
      },
    ],
    commonCauses: [
      {
        type: String,
        trim: true,
      },
    ],
    checks: [
      {
        type: String,
        trim: true,
      },
    ],
    replacements: [
      {
        type: String,
        trim: true,
      },
    ],
    estLaborMin: {
      min: {
        type: Number,
        min: 0,
      },
      max: {
        type: Number,
        min: 0,
      },
    },
    severity: {
      type: String,
      enum: ["critical", "recommended", "monitor"],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    symptoms: [
      {
        type: String,
        trim: true,
      },
    ],
    technicalDetails: {
      ecuModule: {
        type: String,
        trim: true,
      },
      dataBus: {
        type: String,
        trim: true,
      },
      freezeFrameData: {
        type: Boolean,
        default: false,
      },
    },
    vagModels: [
      {
        make: {
          type: String,
          enum: ["VW", "Audi", "Skoda", "Seat", "Porsche"],
          required: true,
        },
        models: [
          {
            type: String,
            trim: true,
          },
        ],
        years: {
          start: {
            type: Number,
            min: 1990,
          },
          end: {
            type: Number,
            max: new Date().getFullYear() + 1,
          },
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
dtcLibrarySchema.index({ code: 1 });
dtcLibrarySchema.index({ modules: 1, severity: 1 });
dtcLibrarySchema.index({ "vagModels.make": 1 });
dtcLibrarySchema.index({ isActive: 1 });

module.exports = mongoose.model("DtcLibrary", dtcLibrarySchema);
