// models/Gift.js
const mongoose = require('mongoose');

const giftSchema = new mongoose.Schema({
  title: { type: String, required: true },
  type: { type: String, enum: ['gold','money','points','other'], default: 'gold' },
  amount: { type: Number, default: 0 },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  issuedTo: [{
    userId: { type: String },
    attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt' },
    issuedAt: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model('Gift', giftSchema);
