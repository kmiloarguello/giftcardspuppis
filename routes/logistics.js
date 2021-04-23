const express = require("express");
const router = express.Router();
const request = require("request");
const https = require("https");
const axios = require('axios');
const cron = require("node-cron");
const multer  =   require('multer');
const path = require('path');
const fs = require('fs');

const { errorGenerator } = require("../utils/curries");
const { response } = require("express");
const { uploadOwner } = require("../utils/multer");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;


router.get("/get-pickup-by-city", (req, res) => {

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
 
});



const getPickupPoints =  () => {
    console.log("⏳ Getting logistics... ");
    return axios.get("/api/logistics/pvt/configuration/pickuppoints/_search");
}

module.exports = router;