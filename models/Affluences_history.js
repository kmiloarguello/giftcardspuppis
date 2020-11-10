const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const Affluences_historySchema = new Schema({
  day: Number,
  open_hour: Date,
  close_hour: Date,
  id_users : { type: mongoose.Schema.Types.ObjectId, ref: 'Users' }
});

//-----Affluences_history model-----//
module.exports = Affluences_history = mongoose.model('Affluences_history', Affluences_historySchema);
