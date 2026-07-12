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

// workboardId 는 unique: true 가 인덱스를 만들므로 별도 선언 안 함 (중복 경고 방지, #694)
loraCacheSchema.index({ serverUrl: 1 });

module.exports = mongoose.model('LoraCache', loraCacheSchema);