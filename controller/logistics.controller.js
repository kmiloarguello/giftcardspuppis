const axios = require('axios');
const {
    getStatesCities,
    getPickupPoints
} = require("../utils/logistics.utils");

exports.getPickupPointByCity = (req, res) => {

    let { query } = req;

    if (Object.keys(query).length == 0 || !/city/ig.test(Object.keys(query)[0]) ) {
        res.sendStatus(400);
        return;
    }

    let cityToSearch = query.city;

    getPickupPoints()
        .then(pickupPoints => {
            console.log("✅ Logistics obtained.");
            let pickUpsFound = pickupPoints.data.items.filter(pick => new RegExp( cityToSearch,"ig").test(pick.address.city) )

            res.json({
                success: true,
                pickupspoints: pickUpsFound
            })            
        })
        .catch(error => {
            console.log("Error getting the logistics", error);
            res.status(500).json({
                success: false,
                message: "There was an error getting the Pickup Points"
            })
        })
 
}

exports.getCoordsByAddress = (req, res) => {

    let { query } = req;

    if (Object.keys(query).length == 0 || !/address/ig.test(Object.keys(query)[0]) ) {
        res.sendStatus(400);
        return;
    }

    let addressToSearch = query.address;
    var apikey = process.env.OPENCAGEDATA;
    var api_url = 'https://api.opencagedata.com/geocode/v1/json';

    var request_url = api_url
        + '?'
        + 'key=' + apikey
        + '&q=' + encodeURIComponent(addressToSearch)
        + '&pretty=1'
        + '&no_annotations=1';

    axios.get(request_url)
        .then(data => {
            
            let results = data.data.results;
            let resultsInColombia = results.filter(result => result.components.country_code == "co");

            res.json({
                success: true,
                results: resultsInColombia
            });
        })
        .catch(err => {
            console.log("ERROR", err)
            res.status(500).json({
                success: false
            })
        });

}

exports.getCoords = (req, res) => {

    let { query } = req;

    if (Object.keys(query).length == 0 || !/address/ig.test(Object.keys(query)[0]) ) {
        res.sendStatus(400);
        return;
    }

    let addressToSearch = query.address;
    const API = process.env.GOOGLEMAPSAPI;
    
    let final_url = "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURI(addressToSearch) + "&key=" + API;
    
    console.log("url::::  ", final_url)
    
    axios.get(final_url)
        .then(data => {
            res.json({
                success: true,
                data: data.data
            })
        })
        .catch(error => {
            res.status(500).json({
                success: false,
                error
            })
        })
    // https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_API_KEY
}

exports.getStatesCities = (req, res) => {

    const { headers } = req;

    if (!headers["rest-range"] || 
        headers["rest-range"].length == 0 ||
        !/resources=/ig.test(headers["rest-range"])
        ) {
        return res.status(400).json({
            success: false,
            message:"There is not REST-range in the header request"
        });
    }

    try {
        
        let restRange = headers["rest-range"].split("resources=")[1];
        const _from = restRange.split("-")[0];
        const _to = restRange.split("-")[1];

        getStatesCities(_from, _to)
            .then(data => data.data)
            .then(statesAndCities => {
                console.log("✅ States and cities obtained obtained.");
                res.json({
                    success: true,
                    value: statesAndCities
                })            
            })
            .catch(error => {
                console.log("Error getting the logistics", error);
                res.status(500).json({
                    success: false,
                    message: "There was an error getting the States & Cities: " + String(error)
                })
            })

    } catch(err) {
        return res.status(500).json({
            success: false,
            message: String(err)
        });
    }
}