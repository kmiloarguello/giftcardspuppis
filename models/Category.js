const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const CategorySchema = new Schema({
  name: { type: String, required : true, unique : true},
  name_es: { type: String, required : true},
  name_fr: { type: String, required : true},
  position: Number,
  attributes: [String]
});

//-----Category model-----//
module.exports = Category = mongoose.model('Category', CategorySchema);
