const express = require("express");
const router = express.Router();
const request = require("request");
var cron = require('node-cron');

const { errorGenerator } = require("../utils/curries");

router.post("/", (req, res) => {

  console.log("Received...", req.body);

  res.json({
    success: true,
    req: req.body
  });
});



module.exports = router;
