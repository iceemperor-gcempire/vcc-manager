const mongoose = require('mongoose');

const loraCacheSchema = new mongoose.Schema({
  workboardId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workboard',
    required: true,
    unique: true
  },
  serverUrl: {
    type: String,
    required: true
  },
  loraModels: [{
    type: String,
    required: true
  }],
  lastFetched: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

loraCacheSchema.index({ workboardId: 1 });
loraCacheSchema.index({ serverUrl: 1 });

module.exports = mongoose.model('LoraCache', loraCacheSchema);