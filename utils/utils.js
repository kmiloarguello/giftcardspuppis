const nodemailer = require('nodemailer');
const request = require("request");
const fs = require("fs");
//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::
//:::                                                                         :::
//:::  This routine calculates the distance between two points (given the     :::
//:::  latitude/longitude of those points). It is being used to calculate     :::
//:::  the distance between two locations using GeoDataSource (TM) prodducts  :::
//:::                                                                         :::
//:::  Definitions:                                                           :::
//:::    South latitudes are negative, east longitudes are positive           :::
//:::                                                                         :::
//:::  Passed to function:                                                    :::
//:::    lat1, lon1 = Latitude and Longitude of point 1 (in decimal degrees)  :::
//:::    lat2, lon2 = Latitude and Longitude of point 2 (in decimal degrees)  :::
//:::    unit = the unit you desire for results                               :::
//:::           where: 'M' is statute miles (default)                         :::
//:::                  'K' is kilometers                                      :::
//:::                  'N' is nautical miles                                  :::
//:::                                                                         :::
//:::  Worldwide cities and other features databases with latitude longitude  :::
//:::  are available at https://www.geodatasource.com                         :::
//:::                                                                         :::
//:::  For enquiries, please contact sales@geodatasource.com                  :::
//:::                                                                         :::
//:::  Official Web site: https://www.geodatasource.com                       :::
//:::                                                                         :::
//:::               GeoDataSource.com (C) All Rights Reserved 2018            :::
//:::                                                                         :::
//:::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::

const calculateDistance = (lat1, lon1, lat2, lon2, unit="K") => {
	if ((lat1 == lat2) && (lon1 == lon2)) {
		return 0;
	}
	else {
		var radlat1 = Math.PI * lat1/180;
		var radlat2 = Math.PI * lat2/180;
		var theta = lon1-lon2;
		var radtheta = Math.PI * theta/180;
		var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
		if (dist > 1) {
			dist = 1;
		}
		dist = Math.acos(dist);
		dist = dist * 180/Math.PI;
		dist = dist * 60 * 1.1515;
		if (unit=="K") { dist = dist * 1.609344 }
		if (unit=="N") { dist = dist * 0.8684 }
		return dist;
	}
}

// Convert the date from Date to TimeUnix
const toTimestamp = (strDate) => {
	var datum = Date.parse(strDate);
	return datum;
};

/**
 * 
 * @param {Number} max_affluences_allowed persons
 * @param {Number} shift_attention_mins minutes
 * @param {Number} time in minutes
 */
const checkMaxAffluencesinSlot = (max_affluences_allowed, shift_attention_mins, time = 30) => {
	return ( time * max_affluences_allowed ) / shift_attention_mins
}

/**
 * Change from hours to days
 * @param {Number} hours 
 */
const fromHoursToDays = (hours) => {
	return (hours / 24)
};

/**
 * Normalize an input value in a given range
 * @param {Number} val 
 * @param {Number} max 
 * @param {Number} min 
 */
const normalizeData = (val, max = 100, min = 0) => {
	// Reajustment for max
	if(val <= 1){
		max = 1;
	}else if(val <= 10 && val > 1){
		max = 10;
	}else if(val <= 100 && val > 10){
		max = 100;
	}else if(val <= 1000 && val > 100){
		max = 1000;
	}else{
		return console.log("Value " + val + " not supported. Check for values between 1 and 1000");
	}

	return (val - min) / (max - min)
};

const isTimestamp = (date) => {
	var $regex = /^\d\d\d\d-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01]) (00|[0-9]|1[0-9]|2[0-3]):([0-9]|[0-5][0-9]):([0-9]|[0-5][0-9])$/;
	return $regex.test(date);
}

const getRandomInt = (max) => {
    return Math.floor(Math.random() * Math.floor(max));
}


const isValidDate = (d) => {
	return d instanceof Date && !isNaN(d);
}

const createAutomaticCheckout = (req) => {

	if(!req) return console.log("Request is undefined to make checkout.");

	let url_dev = 'http://' + process.env.DB_HOST + ':' + process.env.PORT + '/establishment/checkout';
	let url_prod = 'https://' + process.env.DB_HOST + '/establishment/checkout';

	let _options_checkout = {
		url: process.env.ENV == "production" ? url_prod : url_dev,
		method: "PUT",
		headers: {
		'Authorization': req.headers.authorization
		}
	};

	request(_options_checkout, (err, response, body) => {
		if(err) console.error(err);
		if(response && response.statusCode === 200 && typeof body !== "undefined"){
			console.log("Checkout was automatically made.");
		}else{
			console.error("Checkout wasn't made.");
		}
	});
}


const sendConfirmationEmail = ({ author="Edison" ,email, subject, description }) => {
	var transporter = nodemailer.createTransport({
		service: process.env.EMAIL_CONFLUX,
		secure: false, // true for 465, false for other ports
		port: 35,
		auth: {
			user: process.env.EMAIL_CONFLUX,
			pass: process.env.PASSWORD_CONFLUX
		},
		tls: {
			rejectUnauthorized: false
		}
	});

	transporter.verify(function(error, success) {
		if (error) {
		  console.log(error);
		} else {
		  console.log("Server is ready to take our messages",success);
		}
	});
	
	var mailOptions = {
		from: `"${author} from Confflux" <${process.env.EMAIL_CONFLUX}>`,
		to: email,
		subject: subject,
		text: description
	};

	transporter.sendMail(mailOptions, (error, info) => {
		if (error) {
		  console.log("ERROR sending an email", error);
		} else {
		  console.log('Email sent: ' + info.response);
		}
	});

}

/**
 * @description Get the time slot for a given date
 * @param {Date} date 
 * @param {Object} timetable 
 * @param {Number} slotSize 
 */
const getTimeSlotsPerDay = (date, timetable, slotSize = 30) => {
	let timeSlots = [];
	let dayStart = new Date(date);
	let dayEnd = new Date(date);

	// Check all the available days in the DB
	for(let i=0; i < timetable.day.length; i++){

		// TODO: Check the day if the establishment is open or not use timetable.day[i]
		// If the day exists and if that day belongs to the DB
		if(date.getDay() === timetable.day[i]){
			// Asign an stard hour and end hour for that day
			let open_hour = new Date(timetable.open_hour).getUTCHours();
			dayStart.setHours(open_hour,0,0,0);
			let close_hour = new Date(timetable.close_hour).getUTCHours();
			dayEnd.setHours(close_hour,0,0,0);

		}
	}

	do {
		timeSlots.push(new Date(dayStart))
	  	dayStart.setHours(dayStart.getHours(), dayStart.getMinutes() + slotSize);
	} while (dayStart < dayEnd);
  
	return timeSlots;
}

/**
 * Converts a Binary file into a Base64File
 * @param {Fs} file File to encode 
 */
const toBase64 = (file) => {
	return new Promise((resolve, reject) => {
		if(file == undefined){
			reject('no file found');
		} else {
			let encodedData = fs.readFileSync(file, 'base64');
			fs.unlink(file);
			resolve(encodedData.toString('base64'));
	  	}
	});
} 

/**
 * Transform from km to m
 * @param {String} value Value in kilometers
 * @returns {Integer} Value in meters as integer, default = 5000
 */
const fromKMtoM = (value) => {

	if( !value ) return console.log("You should indicate the value to change.");

	let valueInMeters = null;

	if( new RegExp("km","ig").test(value) ){
		try{

			let _lowercase = value.toLowerCase();
			let _withoutSpaces = _lowercase.replace(/\s+/g, '');
			let _onlyNumber = _withoutSpaces.split("km")[0];

			valueInMeters = parseInt(_onlyNumber) * 1000;

			return valueInMeters;

		}catch(err) {
			console.error("🚨 Error trying to clean the value in kilometers", err);
		};
	}else if( new RegExp("m","ig").test(value) ){
		try{
			let _lowercase = value.toLowerCase();
			let _withoutSpaces = _lowercase.replace(/\s+/g, '');
			let _onlyNumber = _withoutSpaces.split("m")[0];

			valueInMeters = parseInt(_onlyNumber) ;

			return valueInMeters;

		}catch(err) {
			console.error("🚨 Error trying to clean the value in meters", err);
		};
	} 

	return 5000; // R
}


module.exports = {
    calculateDistance,
	toTimestamp,
	checkMaxAffluencesinSlot,
	fromHoursToDays,
	normalizeData,
	isTimestamp,
	getRandomInt,
	isValidDate,
	createAutomaticCheckout,
	sendConfirmationEmail,
	getTimeSlotsPerDay,
	toBase64,
	fromKMtoM
}