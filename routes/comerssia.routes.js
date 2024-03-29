const express = require("express");
const router = express.Router();
const Comerssia = require("../controller/comerssia.controller");

router.get("/", Comerssia.getOrders );
router.post("/profile", Comerssia.getProfile );
router.post("/upsert", Comerssia.upsert );
router.post("/update-insider", Comerssia.updateInsiderFromComerssia );
router.get("/config", Comerssia.getConfig);
router.post("/config", Comerssia.updateConfig);

module.exports = router;
