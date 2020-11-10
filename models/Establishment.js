const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const EstablishmentSchema = new Schema({
  name: {type: String, required: true},
  phone: {type: String},
  establishment_pics_url: [String],
  description: String,
  isActive: { type: Boolean, default: true},
  current_affluences: { type: Number, default: 0},
  max_affluences_allowed: { type: Number, default: 5}, 
  shift_attention_mins: { type: Number, default: 10}, 
  shift_schedule_max_hours: { type: Number, default: 24},
  checkin_max_min: { type: Number, default: 15},
  max_shifts: { type: Number, default: 1}, 
  slot_size: { type: Number, default: 30},
  enableShifting: { type: Boolean, default: true },
  enable_ask_document: { type: Boolean, default: false },
  enableShopping: { type: Boolean, default: false },
  max_persons_per_slot: { type: Number, default: 3},
  num_per_shift: Number,
  enable_num_people: Boolean,
  location: {
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
    address: String,
    city: String,
    stateCode: String,
    postalCode: String,
    countryCode: { type: String, default: "FR"},
    country: { type: String, default: 'France'}
  },
  id_opening_hours: { type: mongoose.Schema.Types.ObjectId, ref: 'Opening_hours'},
  id_category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  id_owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner' },
  shifts_checked_at: Date,
  orders_checked_at: Date,
});

//-----Place model-----//
module.exports = Establishement = mongoose.model('Establishment', EstablishmentSchema);
