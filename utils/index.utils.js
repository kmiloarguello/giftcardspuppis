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

/**
 * @desc This function returns the yesterday date
 * @returns "yyyy-mm-dd"
 */
const getYesterdayFormatDay = () => {
	var date = new Date();
	date.setDate(date.getDate() - 1);
	const data = String(date.getFullYear()) + "-" + String(date.getMonth() + 1) + "-" + String(date.getUTCDate());
	return data;
}

/**
 * @desc This function returns the todays date
 * @returns "yyyy-mm-dd"
 */
const getTodayFormatDay = () => {
	var date = new Date();
	const data = String(date.getFullYear()) + "-" + String(date.getMonth() + 1) + "-" + String(date.getUTCDate());
	return data;
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



module.exports = {
    calculateDistance,
	toTimestamp,
	fromHoursToDays,
	normalizeData,
	isTimestamp,
	getRandomInt,
	isValidDate,
	toBase64,
	getYesterdayFormatDay,
	getTodayFormatDay
}