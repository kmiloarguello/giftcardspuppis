const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const QrCodeSchema = new Schema({
  QR: String,
  date: { type: Date, default: Date.now },
  id_establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment' }
});

//-----Location model-----//
module.exports = QrCode = mongoose.model('QrCode', QrCodeSchema);
