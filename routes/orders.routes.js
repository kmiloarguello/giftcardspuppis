const express = require("express");
const router = express.Router();
const axios = require('axios');

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

router.get("/:id", (req, res) => {

    const orderId = req.params.id;

    if (!orderId) {
        return res.status(400).json({
            success: false,
            message: "There is not orderId"
        });
    }

    getOrderInfo(orderId)
        .then(orderInfo => {
            const { data } = orderInfo;
            return res.json({
                success: true,
                value: data
            })
        })
        .catch((err) => {
            console.log("❗ Order: " + orderId + " could not be verified.");
            return res.json({
                success: false,
                message: String(err)
            });
        });
});



const getOrderInfo =  (orderId) => {
  console.log("⏳ Verifying order... " + orderId);
  return axios.get("/api/oms/pvt/orders/" + orderId);
}



module.exports = router;

