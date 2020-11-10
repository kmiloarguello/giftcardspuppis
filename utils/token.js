const jwt = require('jsonwebtoken');
const Keys = require('../config/keys');

// Generate an Access Token for the given User ID
const generateAccessToken = ({ _id, email, type }, expiresIn=parseInt(process.env.TOKEN_EXPIRATION_TIME_SECONDS)) => jwt.sign(
        {
            _id,
            email,
            type, // user type i.e owner or user or manager
            // we can put more user info here.
            // Like the provider
            // Like google or facebook id.
        },
        Keys.secretOrKey, 
        {
            expiresIn: expiresIn,
            subject: _id.toString()
        }
);
    

module.exports = {
    generateAccessToken: generateAccessToken
}