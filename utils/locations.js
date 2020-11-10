const Location = require('../models/Location');

/**
 * Get location by id
 * @param {String} id Location id 
 */
const getLocation = (id) => {

    Location.findOne({ _id: id }, (err, location) => {
        if (err) console.log('Error ' + err); 
        return location
    });

}

/**
 * Get longitude based on location id
 * @param {String} id Location id 
 */
const getLongitude = (id) => {
    Location.findOne({ _id: id }, (err, location) => {
        if (err) console.log('Error ' + err); 
        return location.longitude
    });
}

/**
 * Get latitude based on location id
 * @param {String} id Location id 
 */
const getLatitude = () => {

    Location.findOne({ _id: id }, (err, location) => {
        if (err) console.log('Error ' + err); 
        return location.latitude
    });

}

module.exports = {
    getLocation,
    getLongitude,
    getLongitude
}

