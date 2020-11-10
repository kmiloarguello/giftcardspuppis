const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const LocationSchema = new Schema({
  longitude: { type: String, required: true},
  latitude: { type: String, required: true},
  city: String,
  state_code: String,
  postal_code: String,
  country_code: String,
  country: String,
  location_time: Date,
  id_users : { type: mongoose.Schema.Types.ObjectId, ref: 'Users' }
});

//-----Location model-----//
module.exports = Location = mongoose.model('Location', LocationSchema);
