const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const Opening_hoursSchema = new Schema({
  day: [{
    type: Number,
    enum : [0, 1, 2, 3, 4, 5, 6]
  }], // Sunday - Saturday : 0 - 6
  open_hour: Date,
  close_hour: Date
});

//-----Opening_hours model-----//
module.exports = Opening_hours = mongoose.model('Opening_hours', Opening_hoursSchema);
