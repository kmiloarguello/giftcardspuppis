const axios = require('axios');

const getProductByRef =  (skuId) => {
    console.log("⏳ Verifying sku... " + skuId);
    return axios.get("/api/catalog/pvt/product/" + skuId);
}

const getProductByURL = (url) => {
    console.log("⏳ Verifying url... " + url);
    return axios.get("/api/catalog_system/pub/products/search/" + url);
}


module.exports = {
    getProductByRef,
    getProductByURL
}


