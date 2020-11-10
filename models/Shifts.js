const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const ShiftSchema = new Schema({
  shift_date: { type: Date, required: true },
  shift_code: { type: String, unique: true },
  comments: String,
  shift_checked: { type: Boolean, default: false},
  shift_checked_out: { type: Boolean, default: false },
  num_people_shift: Number,
  id_users: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  id_establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment' }
}, {
  timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

//-----Place model-----//
module.exports = Shift = mongoose.model('Shift', ShiftSchema);
