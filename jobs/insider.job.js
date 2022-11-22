require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const fs = require("fs");
const { readConfig, updateConfig, getNextDay, getNextHours, getHoursDifference } = require("../utils/insider.utils");

axios.defaults.baseURL = "https://" + process.env.ACCOUNTNAME + ".vtexcommercestable.com.br";
axios.defaults.headers.common['X-VTEX-API-AppKey'] = process.env.VTEX_API_KEY;
axios.defaults.headers.common['X-VTEX-API-AppToken'] = process.env.VTEX_API_TOKEN;

const dailyCron  = "0 0 * * *"; // It runs everyday at 00:00
const hourlyCron = "0 * * * *"; // It runs every hour at min 0
const minuteCron = "* * * * *"; // It runs every minute
const secondCron = "* * * * * *"; // It runs every second



const updateLogsFile = (data) => {
    if (!data) return;

    let usersUpdated = 0;
    let message = "";

    const { response } = data;
    if (!response) return;

    if (response.status >= 400) {
        message = response.message;
    } else if (response.status == 200) {
        if (response.data.success === false){
            message = response.data.message;
        }
        if (response.data && response.data.result) {
            const { result } = response.data;
            usersUpdated = result.data.successful && result.data.successful.count ? result.data.successful.count : 0;
            message = result.data.fail && result.data.fail.count ? result.data.fail.count + " users not updated": "";
        }
    }

    console.log("Updating logs file");
    // Data to write on file
    let write_data = `{"date":"${new Date().toISOString()}","day_start":"${data.day_start}","day_end":"${data.day_end}","hour_start":"${data.hour_start}","hour_end":"${data.hour_end}","limit":"${data.limit}","status":"${response.status}","usersUpdated":"${usersUpdated}","message":"${message}"}\n`;
    // Appending data to logs.txt file
    fs.appendFile(`./logs/logs-${new Date().getMonth() + 1}-${new Date().getFullYear()}.log`, write_data, function(err) {
        if (err) throw err;
    });
}

// This function create a POST requests to /api/comerssia/update-insider
const updateInsiderDB = async (params) => {
    const { day_start, hour_start, hour_end, limit } = params;
    if (!day_start || !hour_start || !hour_end || !limit) throw new Error("Missing params");

    const URL = `${process.env.SERVER_HOST}/api/comerssia/update-insider?day_start=${day_start}&day_end=${day_start}&hour_start=${hour_start}&hour_end=${hour_end}&limit=${limit}`;
    const headers = {
        headers: { "Content-Type" : "application/json" }
    };
    const body = {};

    try {
        const response = await axios.post(URL, JSON.stringify(body), headers);
        return { status: response.status, data: response.data };
    } catch (err) {
        return { status: 500, message: err.message };
    }
}

// This function is the main function of the cron job
const main = async () => {
    console.log("\n ⏰ Starting cron job at " + new Date().toUTCString());
    try {

        const config = readConfig();
        const data = config["config"];
        const { frequency } = data;

        if (frequency === "daily") {
            updateCron(dailyCron);
        } else if (frequency === "hourly") {
            updateCron(hourlyCron);
        } else if (frequency === "minute") {
            updateCron(minuteCron);
        } else if (frequency === "second") {
            updateCron(secondCron);
        } else {
            updateCron(dailyCron);
        }

        const response = await updateInsiderDB(data);

        const cDate = new Date(data.day_start + " " + data.hour_start);
        // add one hour to the current hour
        cDate.setHours(cDate.getHours() + 1);

        const day = cDate.getFullYear() + "-" + (cDate.getMonth() + 1) + "-" + cDate.getDate();
        const hour = cDate.getHours() + ":00:00";
        
        const newConfig = {
            config: {
                ...data,
                day_start: day,
                day_end: day,
                hour_start: hour,
                hour_end: getNextHours(hour, 1),
            }
        };

        updateLogsFile({ ...data, response});
        updateConfig(newConfig);

    } catch(err) {
        console.error("There was an error in the Cron",err);
    }
    console.log(" ⏰ Finished at " + new Date().toUTCString() + "\n");
};

let cronJob = cron.schedule(minuteCron, () => {
    main();
});

// this function updates the cron schedule
const updateCron = (cronSchedule) => {
    console.log("Updating cron schedule to", cronSchedule);
    cronJob.stop();
    cronJob = cron.schedule(cronSchedule, main);
};