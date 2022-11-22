const ComerssiaDB = require("../database/comerssia.db");
const sql = require('mssql');
const createError = require('http-errors');
const axios = require('axios');
const { getYesterdayFormatDay, getTodayFormatDay } = require("../utils/index.utils");
const { transformObjectInsider, getPhoneNumber, appendObjectInsider,readConfig, updateConfig, checkDaysOrder, checkHoursOrder,checkDate,checkHour } = require("../utils/insider.utils");

exports.getOrders = (req, res, next) => {

    const query = req.query;

    const { day_start, day_end, hour_start, hour_end, limit } = query;

    const dayStart = day_start ? day_start : getYesterdayFormatDay();
    const dayEnd = day_end ? day_end : getTodayFormatDay();
    const hourStart = hour_start ? hour_start : "00:00:00";
    const hourEnd = hour_end ? hour_end : "23:59:59";
    const TOP = limit ? limit : 10;

    if (!ComerssiaDB.isDBConnected) return next(createError(500, "The connection with the DB is not established yet."));

    const request = new sql.Request();

    request.query(`    
        SELECT top ${TOP}
        ICA.ICPCadena 'Cliente',
        ENC.MOVCodigo,
        ENC.ENCFechaTrx,
        ENC.ENCHoraTrx,
        CASE
            WHEN ENC.MOVCodigo = 'DPDOMVTEX'
                OR ENC.MONCodigo = 'VTAWEB'
                OR ENC.MOVCodigo  = 'NCVTEX'
                OR ENC.MOVCodigo  = 'NCREDWEB'
                OR ENC.MOVCodigo  = 'NCREDW'
                OR ENC.MOVCodigo  = 'DPDOM'
                OR ENC.MOVCodigo  = 'VTADO'
                OR ENC.MOVCodigo  = 'NCCALL' 
            THEN 'ONLINE'
            ELSE 'OFFLINE'
        END AS 
            Origen,
            ENC.ENCCodigo,
            ITE.REFCodigo1,
            RIN.RFICodigo,
            ITE.REFNombreLargo,
            ITE.IRFBruto,
            ITE.IRFVenta,
            ITE.IRFDescuento,
            ITE.IRFInventario,
            ITE.IRFCantidad,
            CLI.CLICodigo, 
            CLI.CLINombres, 
            CLI.CLIApellidos,
            CLI.CLIFechaNacimiento,
            CLI.CLISexo,
            CLI.CLIEmailPrincipal,
            CLI.CLITelefonoCasa,
            CLI.CLICelular
        FROM ${ComerssiaDB.config.dbName}.dbo.Encabezados ENC
        JOIN ItemsCapturas ICA ON ICA.ENCCodigo = ENC.ENCCodigo AND ICA.ICPLetra = 'CLI'
        LEFT JOIN ItemsReferencias ITE ON ITE.ENCCodigo = ENC.ENCCodigo
        JOIN Clientes CLI ON CLI.CLICodigo = ICA.ICPCadena
        JOIN REFIntegraciones RIN ON RIN.REFCodigo1 = ITE.REFCodigo1
        JOIN Referencias ITM ON ITM.REFCodigo1 = ITE.REFCodigo1 
        WHERE 
            ENC.ENCFechaTrx BETWEEN '${dayStart}' AND '${dayEnd}'
            AND GMVCodigo = 'FIN'
            AND ENCHoraTrx BETWEEN '${hourStart}' AND '${hourEnd}'
        ORDER BY ENC.ENCHoraTrx ASC
    `, (err, recordSet) => {
        if (err) return next(createError(err));
        res.json(recordSet);
    }); 

}

exports.getProfile = (req, res, next) => {
    
    const query = req.query;
    const keys = Object.keys(query);

    if (keys.length == 0) return next(createError(400,"There is not query"));

    // Check if there are some keys without the values
    const thereAreEmptyKeys = keys.some(key => query[key].length == 0);

    if (thereAreEmptyKeys) return next(createError(400,"There is not value for the keys"));

    const { email } = query;

    const URL = "https://unification.useinsider.com/api/user/v1/profile";
    const body = { 
        identifiers : { email },
        attributes  : [
            "email",
            "name",
            "surname",
            "phone_number"
        ],
        quota: true 
    };
    const headers = {
        headers: {
            "X-PARTNER-NAME" : process.env.INSIDER_PARTNER,
            "X-REQUEST-TOKEN" : process.env.INSIDER_API_KEY,
            "Content-Type" : "application/json"
        }
    };

    axios.post(URL, JSON.stringify(body), headers)
        .then(response => response.data)
        .then(user => res.json(user))
        .catch(err => next(createError(err)));

}

exports.upsert = (req, res, next) => {

    const insiderURL = process.env.INSIDER_UPSERT_URL;
    const body = req.body;

    const { users } = body;
    if(!users || users.length == 0) return next(createError(400, "There is not users"));
    
    const { identifiers, attributes, events } = users[0]; 
    if (!identifiers || !attributes || !events ) return next(createError(400, "There is not identifiers/attributes/events"));

    const { email } = identifiers;
    if (!email) return next(createError(400, "There is not email"));

    if (Object.keys(attributes) == 0 || events.length == 0 || typeof events != "object") return next(createError(400, "There is not attributes/events"));
    
    const headers = {
        headers: {
            "X-PARTNER-NAME" : process.env.INSIDER_PARTNER,
            "X-REQUEST-TOKEN" : process.env.INSIDER_API_KEY,
            "Content-Type" : "application/json"
        }
    };

    axios.post(insiderURL, JSON.stringify(body), headers)
        .then(data => data.data)
        .then(result => res.json(result))
        .catch(err => next(createError(err)));
}

exports.updateInsiderFromComerssia = (req, res, next) => {
    const { day_start, day_end, hour_start, hour_end, limit } = req.query;
    
    if (!day_start || !day_end || !hour_start || !hour_end || !limit) return next(createError(400));

    const comerssiaURL = `${process.env.SERVER_HOST}/api/comerssia/?day_start=${day_start}&day_end=${day_end}&hour_start=${hour_start}&hour_end=${hour_end}&limit=${limit}`;
    const insiderURL = `${process.env.SERVER_HOST}/api/comerssia/upsert`;
    
    axios.get(comerssiaURL)
        .then(data => data.data)
        .then(records => {
            
            const { recordset } = records;
           
            // filter in online and offline
            const onlineTransactions = recordset.filter(record => record.Origen == "ONLINE");
            const offlineTransactions = recordset.filter(record => record.Origen == "OFFLINE");

            if (onlineTransactions.length == 0 && offlineTransactions.length == 0) return res.json({ success: false, message: "There is not data to send to insider" });

            // For Vtex transaction -> Ask Vtex about the rest of info
            const reqProductIDs = onlineTransactions.map(record => {
                const url = `${process.env.SERVER_HOST}/api/catalog/${record.RFICodigo}`;
                return axios.get(url).then(response => response.data );
            });
            
            Promise.allSettled(reqProductIDs)
                .then(results => results.filter(result => result.status === "fulfilled"))
                .then(results => results.map(result => result.value))
                .then(vtexProducts => {

                    const filterVtexProducts = vtexProducts.filter(product => product && product.LinkId);
                    const reqProducts = filterVtexProducts.map(product => axios.get(`${process.env.SERVER_HOST}/api/catalog/url/${product.LinkId}`).then(response => response.status < 400 ? response.data : null));
                
                    Promise.allSettled(reqProducts)
                        .then(results => results.filter(result => result.status === "fulfilled"))
                        .then(results => results.map(result => result.value))
                        .then(products => products.filter(product => product && product.length > 0))
                        .then(purchase => purchase.map(products => products.map(product => { return { productId: product.productId, categories: product.categories } })))
                        .then(purchase => {
                            
                            let totalUsers = "";
                            const onlineUsers = transformObjectInsider(onlineTransactions, purchase);
                            const offlineUsers = transformObjectInsider(offlineTransactions);
                            totalUsers = appendObjectInsider(onlineUsers, offlineUsers);

                            // Assuming that the append was not possible due one of arrays was undefined
                            // We take either onlineUsers or offlineUsers
                            if (typeof totalUsers == "undefined" || !totalUsers || totalUsers && totalUsers.users && totalUsers.users.length == 0) {
                                if (onlineUsers && onlineUsers.users && onlineUsers.users.length > 0) {
                                    totalUsers = onlineUsers;
                                } else if ( offlineUsers && offlineUsers.users && offlineUsers.users.length > 0 ){
                                    totalUsers = offlineUsers;
                                } 
                            }

                            // If the array is still not valid we just do not send the data
                            if (!totalUsers || totalUsers.users && totalUsers.users.length == 0 ) {
                                return [];
                            } else {
                                return totalUsers;
                            }

                        })
                        .then(records => {

                            if (records.length == 0) {
                                res.json({ success: false, message: "No data has been sent to Insider." })
                            } else {
                                axios.post(insiderURL, records)
                                    .then(data => data.data)
                                    .then(result => res.json({ input: records, result }))
                                    .catch(err => next(createError(err)));
                            }
                            
                        })
                        .catch(err => next(createError(err)));
                })
                .catch(err => next(createError(err)));

        })
        .catch(err => next(createError(err)));

}

exports.getConfig = (req, res, next) => {
    const token = req.headers["puppis-token"];
    if (!token) return next(createError(400, "There is not token"));
    if (process.env.PUPPIS_TOKEN != token) return next(createError(401, "Unauthorized"));
    res.json(readConfig());
}

exports.updateConfig = (req, res, next) => {
    const token = req.headers["puppis-token"];
    if (!token) return next(createError(400, "There is not token"));
    if (process.env.PUPPIS_TOKEN != token) return next(createError(401, "Unauthorized"));
    const body = req.body;
    if (!body || Object.keys(body).length == 0) return next(createError(400, "There is not config"));
    const { day_start, day_end, hour_start, hour_end, limit } = body.config;
    if (!day_start || !day_end || !hour_start || !hour_end || !limit) return next(createError(400, "There is not config"));
    if (!checkDaysOrder(day_start, day_end)) return next(createError(400, "The day_start must be before or equal to day_end"));
    if (!checkHoursOrder(hour_start, hour_end)) return next(createError(400, "The hour_start must be before hour_end"));
    if (!checkDate(day_start)) return next(createError(400, "The day_start is not valid"));
    if (!checkDate(day_end)) return next(createError(400, "The day_end is not valid"));
    if (!checkHour(hour_start)) return next(createError(400, "The hour_start is not valid"));
    if (!checkHour(hour_end)) return next(createError(400, "The hour_end is not valid"));
    updateConfig(body);
    res.json({ success: true, message: "Config has been updated" });
}