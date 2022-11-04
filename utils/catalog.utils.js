const axios = require('axios');

const getProductByRef =  (skuId) => {
    console.log("⏳ Verifying sku... " + skuId);
    return axios.get("/api/catalog/pvt/product/" + skuId);
}


module.exports = {
    getProductByRef
}


