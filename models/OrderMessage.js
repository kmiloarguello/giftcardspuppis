const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const OrderMessageSchema = new Schema({

    id_establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment', required: true},
    id_users : { type: mongoose.Schema.Types.ObjectId, ref: 'Users' , required: true},

    conversation: [
        {
            sender: String,
            senderType: String,
            created_at: { type: Date, default: Date.now },
            text: String
        }
    ],

    id_order:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order'}
  
});

//----- OrderMessage model-----//
module.exports = OrderMessage = mongoose.model('OrderMessage', OrderMessageSchema);
