const { getProductByRef, getProductByURL } = require("../utils/catalog.utils");
const createError = require('http-errors');

exports.getProductBySku = (req, res, next) => {

    const skuId = req.params.id;

    if (!skuId) return next(createError(400, "There is not skuId"));

    getProductByRef(skuId)
        .then(response => response.data)
        .then(product => res.json(product))
        .catch(err => next(createError(err)));
}

exports.searchProductByURL = (req, res, next) => {

    const { url } = req.params;

    if (!url) return next(createError(400, "There is not URL"));

    getProductByURL(url)
        .then(data => data.data)
        .then(product => res.json(product))
        .catch(err => next(createError(err)));
}