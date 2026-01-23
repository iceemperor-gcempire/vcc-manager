const mongoose = require('mongoose');

const selectOptionSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true
  },
  value: {
    type: String,
    required: true
  }
}, { _id: false });

const inputFieldSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  label: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['string', 'select', 'file', 'number', 'boolean'],
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  options: [selectOptionSchema],
  defaultValue: mongoose.Schema.Types.Mixed,
  placeholder: String,
  description: String,
  formatString: {
    type: String,
    default: function() {
      return `{{##${this.name}##}}`;
    }
  },
  validation: {
    min: Number,
    max: Number,
    maxLength: Number,
    pattern: String
  }
}, { _id: false });

const workboardSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  serverUrl: {
    type: String,
    required: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  baseInputFields: {
    aiModel: {
      type: [selectOptionSchema],
      required: true
    },
    imageSizes: [selectOptionSchema],
    referenceImageMethods: [selectOptionSchema],
    stylePresets: [selectOptionSchema],
    upscaleMethods: [selectOptionSchema]
  },
  additionalInputFields: [inputFieldSchema],
  workflowData: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

workboardSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  return this.save();
};

workboardSchema.methods.validateWorkflowData = function() {
  try {
    JSON.parse(this.workflowData);
    return true;
  } catch (error) {
    return false;
  }
};

module.exports = mongoose.model('Workboard', workboardSchema);