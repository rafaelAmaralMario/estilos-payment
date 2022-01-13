const { Sequelize } = require('sequelize');
const {getEnvironmentVariable} = require('../../config');
const {LogFactory} = require('../../../logger')
const sql = require('mssql')

async function connectToDataBase() {
    const logger = LogFactory.logger();
    try {
        logger.debug(`Connection with Database`);
        const dbName = getEnvironmentVariable("DB_NAME")
        const dbUser = getEnvironmentVariable("DB_USER")
        const dbPass = getEnvironmentVariable("DB_PASS")
        const dbHost = getEnvironmentVariable("DB_HOST")
        logger.debug(`dbHost ${dbHost}`);

        const sequelize = new Sequelize(dbName, dbUser, dbPass, {
            host: dbHost,
            dialect: 'mssql'
        });

        await sequelize.authenticate();
        logger.debug(`Connection has been established successfully.`);
        return sequelize;
    
    } catch (error) {
        logger.debug(`Unable to connect to the database: ${JSON.stringify(error)}`);
        throw new Error(error);        
    }

}



  
  async function getSQLTarifario(tarjeta) {
    const dbName = getEnvironmentVariable("DB_NAME")
    const dbUser = getEnvironmentVariable("DB_USER")
    const dbPass = getEnvironmentVariable("DB_PASS")
    const dbHost = getEnvironmentVariable("DB_HOST")

    try {
        const sqlConfig = {
            user: dbUser,
            password: dbPass,
            database: dbName,
            server: dbHost,
            pool: {
              max: 10,
              min: 0,
              idleTimeoutMillis: 30000
            },
            options: {
              encrypt: true, // for azure
              trustServerCertificate: false // change to true for local dev / self-signed certs
            }
          }
            logger.debug(`Connection with Database`);
           // make sure that any items are correctly URL encoded in the connection string
            await sql.connect(sqlConfig)
            const results = await sql.query`EXEC dbo.sp_web_consultaTarifario ${tarjeta}`

      return results;
    } catch (error) {
        throw new Error({error, hasError: true})
    }
    
}



module.exports = {
    getSQLTarifario
 };
 