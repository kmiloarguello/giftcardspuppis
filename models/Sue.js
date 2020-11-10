const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const SueSchema = new Schema({
    id_person: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},                //id de la persona
    date: { type: Date, default: Date.now },                    //fecha y hora de la demanda
    id_location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location'},                //localización de la demanda
    sue_category: String,            //categoria de la demanda
    title: String,                    //titulo de la demanda
    description: String                //descripción de la demanda
});

//-----Sue model-----//
module.exports = Sue = mongoose.model('Sue', SueSchema);
