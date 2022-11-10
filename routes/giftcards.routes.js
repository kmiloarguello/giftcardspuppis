const express = require("express");
const router = express.Router();
const axios = require('axios');
const Giftfcards = require("../controller/giftcards.controller");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

router.post("/", Giftfcards.update );

module.exports = router;

