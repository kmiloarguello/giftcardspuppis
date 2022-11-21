const fs = require("fs");

/**
 * @desc    This function creates the object to send to Insider
 * @param {Array} recordset -> Data from Comerssia
 * @param {Array} purchase -> Data from Vtex [{ productId : '', categories : [..]}]
 * @returns 
 */
const transformObjectInsider = (recordset, purchase) => {
    if (!recordset) return console.error("🔴 Error in record set");

    // Helper to avoid construct data from not valid data
    if (recordset.length == 0) return;

    let clientes = recordset.filter(user => user.CLIEmailPrincipal && user.CLIEmailPrincipal.length > 0);

    const categories = purchase && purchase.length > 0 ? purchase.map(p => { return { productId : p[0].productId, categories: p[0].categories } }) : null;

    const users = clientes.map(client => {

        let taxonomy = [];

        if (categories) {
            categories.map(cat => {
                if (cat.productId == client.RFICodigo) {
                    taxonomy.push(cat.categories);
                }
            });
        }
        
        let user = {
            identifiers: {
                email: client.CLIEmailPrincipal,
            },
            attributes: {
                email_optin: true,
                sms_optin: true,
                whatsapp_optin: true,
                name: client.CLINombres,
                surname: client.CLIApellidos,
                birthday: client.CLIFechaNacimiento,
                gender: client.CLISexo && !client.CLISexo.startsWith(" ") ? client.CLISexo : null,
                language: "es-co",
                country: "CO",
                phone_number: getPhoneNumber(client),
                custom: {
                    origen : client.Origen
                }
            },
            events:[
                {
                    event_name: "purchase",
                    timestamp: client.ENCFechaTrx,
                    event_params : {
                        product_id: client.RFICodigo,
                        unit_price: client.IRFBruto,
                        unit_sale_price: client.IRFVenta,
                        event_group_id: String(client.ENCCodigo),
                        taxonomy: categories ? taxonomy[0] : taxonomy,
                        currency: "COP"   
                    }
                }
            ]
        }

        return user;
    });

    return { users };
}


/**
 * @desc    This function append one user into the set of users
 * @param {Object} usersA 
 * @param {Object} usersB 
 * @returns 
 */
const appendObjectInsider = (usersA, usersB) => {
    if(!usersA || !usersA.users || usersA.users.length == 0) return null;
    if(!usersB || !usersB.users || usersB.users.length == 0) return null;

    usersB.users.map(user => usersA.users.push(user));
    return usersA;
}


/**
 * @desc    This function obtains the customer number
 * @param {Object} client 
 * @returns 
 */
const getPhoneNumber = (client) => {
    let phone_number = "";

    if (client.CLICelular != "N/A" && client.CLICelular.length > 3) {
        if (client.CLICelular.startsWith("+57")) {
            phone_number = client.CLICelular;
        } else if (client.CLICelular.startsWith("57")) {
            phone_number = "+" + client.CLICelular;
        } else {
            phone_number = "+57" + client.CLICelular;
        }
    } else if (client.CLITelefonoCasa != "N/A" && client.CLICelular.length > 3) {
        if (client.CLITelefonoCasa.startsWith("+57")) {
            phone_number = client.CLITelefonoCasa
        } else if (client.CLITelefonoCasa.startsWith("57")) {
            phone_number = "+" + client.CLITelefonoCasa;
        } else {
            phone_number = "+57" + client.CLITelefonoCasa;
        }
    } else {
        phone_number = "";
    }

    return phone_number;
}

// this function gets the next day from a given date in format yyyy-mm-dd
// example: getNextDay(2021-01-01) -> 2021-01-02
const getNextDay = (date) => {
    const dateParts = date.split("-");
    const dateObject = new Date(+dateParts[0], dateParts[1] - 1, +dateParts[2]);
    console.log(dateObject.getDate())
    dateObject.setDate(dateObject.getDate() + 1);
    return dateObject.getFullYear() + "-" + (dateObject.getMonth() + 1) + "-" + dateObject.getDate();
}


// this function gets the next hour in format hh:mm:ss
// it receives 2 parameters: hour and how many of hours to add
// it returns the next hour in format hh:mm:ss
// example: getNextHours(20:00:00, 2) -> 22:00:00
//          getNextHours(18:45:00, 1) -> 19:45:00           
const getNextHours = (hour,plus) => {
    const date = new Date();
    const dateParts = hour.split(":");
    date.setHours(dateParts[0],dateParts[1],dateParts[2]);
    date.setHours(date.getHours() + plus);
    return date.toTimeString().split(" ")[0];
}


// This function calculates the difference between two hours in format hh:mm:ss
// it receives 2 parameters: hour1 and hour2
// it returns the difference in hours
// example: getHoursDifference(20:00:00, 22:00:00) -> 2
//          getHoursDifference(18:45:00, 19:45:00) -> 1
const getHoursDifference = (hour1, hour2) => {
    const date1 = new Date();
    const date2 = new Date();
    const dateParts1 = hour1.split(":");
    const dateParts2 = hour2.split(":");
    date1.setHours(dateParts1[0],dateParts1[1],dateParts1[2]);
    date2.setHours(dateParts2[0],dateParts2[1],dateParts2[2]);
    const difference = Math.abs(Math.round((date2.getTime() - date1.getTime()) / 1000 / 60 / 60))
    return difference
}

// This function returns true if the hour:minute:second passed as parameter is greater than 22:00:00
// it should count the minutes and seconds
// example: isGreaterThan22(20:00:00) -> false
//          isGreaterThan22(21:15:00) -> false
//          isGreaterThan22(22:00:00) -> false
//          isGreaterThan22(22:01:00) -> true
//          isGreaterThan22(22:30:00) -> true
//          isGreaterThan22(23:00:00) -> true
const isGreaterThan22 = (hour) => {
    const date = new Date();
    const dateParts = hour.split(":");
    date.setHours(dateParts[0],dateParts[1],dateParts[2]);
    return date.getHours() >= 22;
}

// This function returns false if the initialDate is greater or equal than finalDate
// it receives 2 parameters: initialDate and finalDate
// example: checkDaysOrder(2021-01-01, 2021-01-02) -> true
//          checkDaysOrder(2021-01-02, 2021-01-01) -> false
//          checkDaysOrder(2021-01-02, 2021-01-02) -> true
const checkDaysOrder = (initialDate, finalDate) => {
    const date1 = new Date();
    const date2 = new Date();
    const dateParts1 = initialDate.split("-");
    const dateParts2 = finalDate.split("-");
    date1.setFullYear(dateParts1[0],dateParts1[1] - 1,dateParts1[2]);
    date2.setFullYear(dateParts2[0],dateParts2[1] - 1,dateParts2[2]);
    return date1.getTime() <= date2.getTime();
}

// This function returns false if the initialHour is greater or equal than finalHour
// it receives 2 parameters: initialHour and finalHour in format hh:mm:ss
// example: checkHoursOrder(20:00:00, 22:00:00) -> true
//          checkHoursOrder(22:00:00, 20:00:00) -> false
//          checkHoursOrder(22:00:00, 22:00:00) -> false
const checkHoursOrder = (initialHour, finalHour) => {
    const date1 = new Date();
    const date2 = new Date();
    const dateParts1 = initialHour.split(":");
    const dateParts2 = finalHour.split(":");
    date1.setHours(dateParts1[0],dateParts1[1],dateParts1[2]);
    date2.setHours(dateParts2[0],dateParts2[1],dateParts2[2]);
    return date1.getTime() < date2.getTime();
}


// This function checks if a day is from the form yyyy-mm-dd
// it returns true if it is
// it should check the format and the values of the day
// it receives 1 parameter: date
// example: checkDate(2021-01-01) -> true
//          checkDate(2021-01-1) -> false
//          checkDate(2021-1-01) -> false
//          checkDate(2021-1-1) -> false
//          checkDate(2021-01-01 00:00:00) -> false
//          checkDate(2021-01-01 00:00:01) -> false
//          checkDate(2021-01-01 00:01:00) -> false

const checkDate = (date) => {
    const dateParts = date.split("-");
    const dateObject = new Date(+dateParts[0], dateParts[1] - 1, +dateParts[2]);
    return dateObject.getFullYear() == dateParts[0] && dateObject.getMonth() + 1 == dateParts[1] && dateObject.getDate() == dateParts[2];
}

// This function checks if a hour is from the form hh:mm:ss
// it returns true if it is
// it should check the format and the values of the hour
// it receives 1 parameter: hour
// example: checkHour(20:00:00) -> true
//          checkHour(20:00:0) -> false
//          checkHour(20:0:00) -> false
//          checkHour(20:0:0) -> false
//          checkHour(20:00:00 00:00:00) -> false
//          checkHour(20:00:00 00:00:01) -> false
//          checkHour(20:000:00) -> false
//          checkHour(20:00:000) -> false
//          checkHour(20:000:000) -> false

const checkHour = (hour) => {
    const dateParts = hour.split(":");
    const dateObject = new Date(0, 0, 0, +dateParts[0], +dateParts[1], +dateParts[2]);
    return dateObject.getHours() == dateParts[0] && dateObject.getMinutes() == dateParts[1] && dateObject.getSeconds() == dateParts[2];
}

// this function reads the file ./jobs/config.job.json and returns the data
const readConfig = () => {
    const data = fs.readFileSync("./jobs/config.job.json");
    return JSON.parse(data);
}

// this function updates the file ./jobs/config.job.json with the new data
const updateConfig = (data) => {
    fs.writeFileSync("./jobs/config.job.json", JSON.stringify(data));
}

module.exports = {
    transformObjectInsider,
    getPhoneNumber,
    appendObjectInsider,
    readConfig,
    updateConfig,
    getNextDay,
    getNextHours,
    getHoursDifference,
    isGreaterThan22,
    checkDaysOrder,
    checkHoursOrder,
    checkDate,
    checkHour
}