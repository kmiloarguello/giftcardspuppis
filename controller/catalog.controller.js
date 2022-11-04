const { getProductByRef } = require("../utils/catalog.utils");
const createError = require('http-errors');

exports.getProductBySku = (req, res, next) => {

    const skuId = req.params.id;

    if (!skuId) return next(createError(400, "There is not skuId"));

    getProductByRef(skuId)
        .then(productInfo => {
            const { data } = productInfo;
            return res.json(data);
        })
        .catch(err => next(createError(err)));
}