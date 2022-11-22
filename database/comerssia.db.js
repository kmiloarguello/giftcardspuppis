const sql = require('mssql')


const DB = {
    isDBConnected : false,

    config : {
        dbName: process.env.DB_COMERSSIA_NAME,
        dbConfig: {
            server: process.env.DB_COMERSSIA_HOST,
            options: {
                port: parseInt(process.env.DB_COMERSSIA_PORT),
                trustServerCertificate: true
            },
            authentication: {
                type: "default",
                options: {
                    userName: process.env.DB_COMERSSIA_USER,
                    password: process.env.DB_COMERSSIA_PASSWORD
                }
            }
        }
    },

    init() {
        this.mssqlConnection();
    },

    /**
     * 
     */
    mssqlConnection () {

        const { dbName } = this.config;
        const { server } = this.config.dbConfig;
        const { port } = this.config.dbConfig.options;
        const { userName, password } = this.config.dbConfig.authentication.options;

        if (!dbName || !server || !port || !userName || !password) return console.log("There is not data to create connectiion");

        const _config = {
            user: userName,
            password: password,
            database: dbName,
            server: server,
            port: port,
            pool: {
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000
            },
            options: {
                encrypt: true, // for azure
                trustServerCertificate: true // change to true for local dev / self-signed certs
            }
        }

        console.log("-- ⏳ Connecting with the DB ... ⏳ --");

        // make sure that any items are correctly URL encoded in the connection string
        sql.connect(_config, (err) => {
            if (err) console.error("🔌 🚨🚨🚨 Error connecting with the DB", err);
            this.isDBConnected = true;
            console.log("🔌 ✅ Connection established with Database: " + dbName );
        });
    },
};

DB.init();

module.exports = DB;