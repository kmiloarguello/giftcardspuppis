const express = require("express");
const router = express.Router();
const axios = require('axios');
const Catalog  = require("../controller/catalog.controller");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

router.get("/:id", Catalog.getProductBySku );

module.exports = router;

