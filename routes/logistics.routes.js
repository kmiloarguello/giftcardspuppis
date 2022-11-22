const express = require("express");
const router = express.Router();
const axios = require('axios');
const Logistics = require("../controller/logistics.controller");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

router.get("/get-pickup-by-city", Logistics.getPickupPointByCity);
router.get("/get-coords-by-address", Logistics.getCoordsByAddress);
router.get("/get-coords", Logistics.getCoords);

/**
 * Get all the states & cities for the Modal
 */
router.get("/get-states-cities", Logistics.getStatesCities);



module.exports = router;