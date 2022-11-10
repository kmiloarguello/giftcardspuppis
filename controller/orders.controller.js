const { getOrderInfo } = require("../utils/orders.utils");

exports.getOrderById = (req, res) => {

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
}