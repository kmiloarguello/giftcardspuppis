const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const ShiftMessageSchema = new Schema({

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

    id_shift:  { type: mongoose.Schema.Types.ObjectId, ref: 'Shift'}
  
});

//----- ShiftMessage model-----//
module.exports = ShiftMessage = mongoose.model('ShiftMessage', ShiftMessageSchema);
