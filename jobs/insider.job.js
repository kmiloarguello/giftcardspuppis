const cron = require('node-cron');
const axios = require('axios');
const fs = require("fs");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

const dailyCron = "0 0 * * *"; // everyday at 00:00
const minuteCron = "* * * * * *";

cron.schedule(minuteCron, () => {
    // Data to write on file
    let data = `${new Date().toUTCString()} : Server is working\n`;
      
    // Appending data to logs.txt file
    fs.appendFile("./logs/logs.txt", data, function(err) {
        if (err) throw err;
        console.log("Status Logged!");
    });
});