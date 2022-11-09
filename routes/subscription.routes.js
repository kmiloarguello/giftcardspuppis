const express = require("express");
const router = express.Router();
const axios = require('axios');
const Subscription  = require("../controller/subscription.controller");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

router.post("/login", Subscription.login );
router.get("/", Subscription.findAll );
router.get("/:id", Subscription.findOne );
router.patch("/:id", Subscription.update );

module.exports = router;

