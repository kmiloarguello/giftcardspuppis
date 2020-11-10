const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const OrderSchema = new Schema({
  user_name: String,
  address: String,
  phone: String,
  orderTime: { type: Date, default: Date.now },
  deliveredTime: Date,
  status: { type: String, default: "onGoing" },
  id_establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment'},
  id_users : { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

//----- Order model-----//
module.exports = Order = mongoose.model('Order', OrderSchema);
