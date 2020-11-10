const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const ManagerSchema = new Schema({
  user_name: String,
  user_code: String,
  email: { type: String, required : true, unique : true},
  password: { type: String, required: true },
  isSuperUser: { type: Boolean, default: true }
});

//-----Place model-----//
module.exports = Manager = mongoose.model('Manager', ManagerSchema);
