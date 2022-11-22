const axios = require('axios');

const getProductByRef =  (skuId) => {
    return axios.get("/api/catalog/pvt/product/" + skuId);
}

const getProductByURL = (url) => {
    return axios.get("/api/catalog_system/pub/products/search/" + url);
}


module.exports = {
    getProductByRef,
    getProductByURL
}


