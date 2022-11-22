const axios = require('axios');

const getStatesCities = (_from, _to) => {
    console.log("⏳ Getting states & cities... ");
    return axios.get("/api/dataentities/CI/search?_fields=postalCode,city,state", {
        headers: {
            "REST-Range": "resources=" + _from + "-" + _to
        }
    });
}

const getPickupPoints =  () => {
    console.log("⏳ Getting logistics... ");
    return axios.get("/api/logistics/pvt/configuration/pickuppoints/_search");
}

module.exports = {
    getStatesCities,
    getPickupPoints
}