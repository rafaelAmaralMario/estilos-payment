const { Sequelize } = require('sequelize');
const {getEnvironmentVariable} = require('../../config');
const {LogFactory} = require('../../../logger')



async function connectToDataBase() {
    const logger = LogFactory.logger();
    try {
        logger.debug(`Connection with Database`);
        const dbName = getEnvironmentVariable("DB_NAME")
        const dbUser = getEnvironmentVariable("DB_USER")
        const dbPass = getEnvironmentVariable("DB_PASS")
        const dbHost = getEnvironmentVariable("DB_HOST")
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

    try {
        const sequelize = await connectToDataBase();

        const results = await sequelize.query(`EXEC dbo.sp_web_consultaTarifario ${tarjeta}`);

      return results;
    } catch (error) {
        throw new Error({error, hasError: true})
    }
    
}

module.exports = {
    getSQLTarifario
 };
 