const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Create Schema
const VisitSchema = new Schema({
    checkin_time: Date,
    checkout_time: Date,
    location: {
        latitude: String,
        longitude: String,
    },
    visit_made: { type: Boolean, default: false }, // Allow us to decide whether the user made or not a visit
    //id_locations_user: { type: mongoose.Schema.Types.ObjectId, ref: 'Users'},
    id_shifts: { type: mongoose.Schema.Types.ObjectId, ref: 'Shifts' },
    id_users : { type: mongoose.Schema.Types.ObjectId, ref: 'Users' }, 
    id_establishment: { type: mongoose.Schema.Types.ObjectId, ref: 'Establishment'},
});

//-----Place model-----//
module.exports = Visits = mongoose.model('Visits', VisitSchema);
