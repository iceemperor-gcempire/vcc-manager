const mongoose = require('mongoose');

const modelCacheSchema = new mongoose.Schema({
  serverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Server',
    required: true,
    unique: true
  },
  serverUrl: {
    type: String,
    required: true
  },
  checkpointModels: [{
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

modelCacheSchema.index({ serverId: 1 });
modelCacheSchema.index({ serverUrl: 1 });

module.exports = mongoose.model('ModelCache', modelCacheSchema);
