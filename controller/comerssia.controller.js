const ComerssiaDB = require("../database/comerssia.db");
const sql = require('mssql');
const createError = require('http-errors');
const axios = require('axios');
const { getYesterdayFormatDay, getTodayFormatDay } = require("../utils/index.utils");
const { transformObjectInsider, getPhoneNumber } = require("../utils/insider.utils");

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
    const body = { identifiers: { email } };
    const headers = {
        headers: {
            "X-PARTNER-NAME" : process.env.INSIDER_PARTNER,
            "X-REQUEST-TOKEN" : process.env.INSIDER_API_KEY,
            "Content-Type" : "application/json"
        }
    };
    axios.post(URL, JSON.stringify(body), headers)
        .then(res => res.json(res))
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
            const reqProductIDs = recordset.map(record => axios.get(`${process.env.SERVER_HOST}/api/catalog/${record.RFICodigo}`).then(data => data.data));
            
            Promise.all(reqProductIDs)
                .then(vtexProducts => {

                    const reqProducts = vtexProducts.map(product => axios.get(`${process.env.SERVER_HOST}/api/catalog/url/${product.LinkId}`).then(data => data.data));

                    Promise.all(reqProducts)
                        .then(products => products.filter(product => product.length > 0))
                        .then(purchase => purchase.map(products => products.map(product => { return { productId: product.productId, categories: product.categories } })))
                        .then(purchase => transformObjectInsider(records, purchase))
                        .then(records => {
                            axios.post(insiderURL, records)
                                .then(data => data.data)
                                .then(result => res.json({ input: records, result }))
                                .catch(err => next(createError(err)));
                        })
                        .catch(err => next(createError(err)));
                        
                })
                .catch(err => next(createError(err)));

        })
        .catch(err => next(createError(err)));

}