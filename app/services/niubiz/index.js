/*
 ** Copyright (c) 2021 Oracle and/or its affiliates.
 */

const axios = require('axios');
const {getEnvironmentVariable} = require('../../config');
const {LogFactory} = require('../../../logger')
const {getAmount} = require("../utils")

function getError(error) {

    return JSON.stringify({ name: error.name, message: error.message, stack: error.stack }, null, 2);
}

 async function getApiToken() {
  const logger = LogFactory.logger();

    try {

        logger.debug(`Get API TOKEN:`);

        const baseURL = getEnvironmentVariable('NB_URL');
        const username = getEnvironmentVariable('NB_USERNAME');
        const password = getEnvironmentVariable('NB_PASSWORD');
   
        const headers = {
           Authorization: `Basic ${Buffer.from(`${username}:${password}`, 'utf-8').toString('base64')}`,
           'Content-Type': 'application/json'
         };

        const response = await axios({
          method: 'GET',
          url: `${baseURL}/api.security/v1/security`,
          headers 
        });
    
        const {data} = response;

        return data;

      } catch (error) {
          const errorMessage = getError(error)
        logger.debug(`ERROR AUTH TOKEN: ${JSON.stringify(errorMessage)}`);

        return false;
    }
 }

 async function confirmarPago(object,merchant,token) {
  const logger = LogFactory.logger();

     try {
        const baseURL = getEnvironmentVariable('NB_URL');

        logger.debug(` Confirmar PAGO`);
    
         const data = {
                 "channel" : "pasarela",
                 "captureType" : "manual",
                 "order" : {
                     "purchaseNumber" : object['purchaseNumber'],
                     "amount" : object['amount'],
                     "currency" : "PEN",
                     "transactionId" : object['transactionId']
                }
            };
    
            const headers = {
                'Content-Type' : 'application/json',
                'Authorization' : token,
             }
        
             const response = await axios({
                method: 'POST',
                url: `${baseURL}/api.confirmation/v1/confirmation/ecommerce/${merchant}`,
                headers,
                data 
              });
    
         return response.data;
     } catch (error) {
        const errorMessage = getError(error)
        logger.debug(`ERROR Confirmar PAGO: ${JSON.stringify(errorMessage)}`);

        return {}
         
     }
    

 }

 async function autorizarTarjeta(object,merchantId,token) {
   const logger = LogFactory.logger();
    try {
        logger.debug(`GET Authorizar TARJETA`);
        const baseURL = getEnvironmentVariable('NB_URL');
        const data = {
                "channel" : "pasarela",
                "captureType" : "manual",
                "countable" : "false",
                "order" : {
                    "tokenId" : object['tokenId'],
                    "purchaseNumber" : object['purchaseNumber'],
                    "amount" : object['amount'],
                    "currency" : object["currency"]
                }
               }
            ;
   
        const headers = {
           'Content-Type' : 'application/json',
           'Authorization' : token,
        }
   
        logger.debug(`url Authorizar TARJETA: ${baseURL}/api.authorization/v3/authorization/ecommerce/${merchantId}`);
        logger.debug(`headers Authorizar TARJETA: ${JSON.stringify(headers)}`);
        logger.debug(`body Authorizar TARJETA: ${JSON.stringify(data)}`);

        const response = await axios({
           method: 'POST',
           url: `${baseURL}/api.authorization/v3/authorization/ecommerce/${merchantId}`,
           headers,
           data 
         });

         const {data: responseData} = response;

        logger.debug(`Response authorizar tarjeta: ${JSON.stringify(responseData)}`);

        if (responseData["order"]["transactionId"]) {
      
            const responseObject = {
                'transactionId' : responseData["order"]["transactionId"],
                'amount' : responseData["order"]["amount"],
                'currency' : responseData["order"]["currency"],
                'purchaseNumber' : responseData["order"]["purchaseNumber"]
        };
            const confirmation = await confirmarPago(responseObject, merchantId, token);
            return confirmation;
        }
        else {
        
           return responseData;
        }        
    } catch (error) {
        const errorMessage = getError(error)
        
        logger.debug(`ERROR authorizar tarjeta: ${JSON.stringify(errorMessage)}`);
        
        return {}
    }
 }

 async function antiFraude(data) {
   const logger = LogFactory.logger();
    try {
        logger.debug(`GET ANTI FRAUDE`);
        const baseURL = getEnvironmentVariable('NB_URL');
        const merchantId = getEnvironmentVariable('NB_MERCHANTID');
    
        data['amount'] = getAmount(data['amount']);
        data['orderId'] = data['orderId'].slice(1,data['orderId'].length);
         
         const words = data['holderName'].split(" ");
    
         const firstName = words[0];
         const lastName = words[1];
    
    
         const authToken = await getApiToken();
         const headers = {
            'Content-Type' : 'application/json',
            Authorization : authToken
        }
    
         const body = {
                 "channel": "pasarela",
                 "merchantDefineData" : {
                     "MDD5" : "AFKI345",
                     "MDD93" : "20187654324"
                },
                 "billingAddress" : {
                     "street1" : data['address1'],
                     "postalCode" : data['postalCode'],
                     "city"  : data['city'],
                     "state"  : data['state'],
                     "country"  : data['country']
                 },
                 "order" : {
                     "purchaseNumber" : data['orderId'],
                     "amount" : data['amount'],
                     "currency" : data['currencyCode']
                    }
                 ,
                 "card" : {
                     "cardNumber" :  data['cardNumber'],
                     "expirationMonth" : data['expirationMonth'],
                     "expirationYear" :data['expirationYear'],
                     "cvv2" : data['expirationYear']
                 },
                 "cardHolder" : {
                     "firstName":  firstName,
                     "lastName" : lastName,
                     "email" : data['email'],
                 }
                };

                logger.debug(`url AntiFraude TARJETA: ${baseURL}/api.antifraud/v1/antifraud/ecommerce/${merchantId}`);
                logger.debug(`headers AntiFraude: ${JSON.stringify(headers)}`);
                logger.debug(`body AntiFraude: ${JSON.stringify(body)}`);
    
                const response = await axios({
                    method: 'POST',
                    url: `${baseURL}/api.antifraud/v1/antifraud/ecommerce/${merchantId}`,
                    headers,
                    data : JSON.stringify(body) 
                  });
    
        const {status, data: responseData} = response; 
         if (status === 200 && responseData['token']['tokenId']) {
             const responseObject = {
                 "tokenId" : responseData['token']['tokenId'],
                 "purchaseNumber" : responseData['order']['purchaseNumber'],
                 "amount" : responseData['order']['amount'],
                 "currency" : responseData['order']['currency']
             };
             const autorizacion = await autorizarTarjeta(responseObject, merchantId, authToken);
             return autorizacion;
         }
    
         return response.data;
    } catch (error) {
        const errorMessage = getError(error)
        
        logger.debug(`ERROR ANTIFRAUDE: ${JSON.stringify(error)}`);
        return {error}
    }

 }

 async function payment(request) {
    const logger = LogFactory.logger();
    
    let authorizationResponse = {}
    try {
        logger.debug(`GET PAYMENT`);
        const cardObject = {
            "cardNumber" : request.cardDetails['number'],
            "expirationMonth" : request.cardDetails['expirationMonth'],
            "expirationYear" : request.cardDetails['expirationYear'],
            "cvv2" : request.cardDetails['cvv'],
            "holderName" : request.cardDetails['holderName'],
            "amount" : request.amount,
            "orderId" : request.orderId,
            "firstName" : request.billingAddress['firstName'],
            "lastName" : request.billingAddress['lastName'],
            "address1" : request.billingAddress['address1'],
            "postalCode" : request.billingAddress['postalCode'],
            "city" : request.billingAddress['city'],
            "state" : request.billingAddress['state'],
            "country" : request.billingAddress['country'],
            "email" : request.billingAddress['email'],
            "transactionId" : request.transactionId,
            "currencyCode" : request.currencyCode,
        };

        const validacion = await antiFraude(cardObject);

        if(validacion.error) {
            return {
                "orderId"           : request.orderId,
                "currencyCode"      : request.currencyCode,
                "transactionId"     : request.transactionId,
                "paymentId"         : request.paymentId,
                "amount"            : request.amount,
                "transactionType"   : request.transactionType,
                "hostTransactionTimestamp"  : request.transactionTimestamp,
                "transactionTimestamp"      : request.transactionTimestamp,
                "paymentMethod"             : request.paymentMethod,
                "gatewayId"                 : request.gatewayId,
                "siteId"                    : request.siteId,
                "authorizationResponse" : {
                    "responseCode" : "9000",
                    "responseReason" : "failed on payment",
                    "responseDescription" :  "failed on payment",
                    "authorizationCode" : "error",
                    "hostTransactionId" : "error"
                },
                "additionalProperties": {
                    error : validacion.error
                }
            }
        }

        let responseCode = "";
        let responseReason = "" 
        let responseDescription =""  
        let authorizationCode = ""
        let hostTransactionId = ""
        let merchantTransactionId = ""
        let hostTimestamp = new Date().getTime();
       
        if (!validacion["dataMap"]) {
            logger.debug(`ERROR ON VALIDATION PAYMENT ${JSON.stringify(validacion, null, 2)}`);

            responseCode = "9000";
            responseReason = validacion["errorMessage"];
            responseDescription = validacion["data"]["MESSAGE"];
            authorizationCode = validacion["data"]["REASON_CODE"];
            hostTransactionId = validacion["data"]["REQUEST_ID"];
        } else {
            logger.debug(`APPROVED VALIDATION PAYMENT ${JSON.stringify(validacion["dataMap"], null, 2)}`);
            logger.debug(`APPROVED TRANSACTION_ID ${validacion["dataMap"]["TRANSACTION_ID"]}`);

            responseCode = "1000";
            responseReason = validacion["dataMap"]["ACTION_DESCRIPTION"] 
            responseDescription = validacion["dataMap"]["TRANSACTION_ID"] 
            authorizationCode = validacion["dataMap"]["AUTHORIZATION_CODE"]
            hostTransactionId = validacion["dataMap"]["TRANSACTION_ID"]
            merchantTransactionId = validacion["dataMap"]["MERCHANT"]
            hostTimestamp = validacion["dataMap"]["TRANSACTION_DATE"]
        }

        
        authorizationResponse = {
            authorizationResponse: {
                "responseCode" : responseCode,
                "responseReason" : responseReason,
                "responseDescription" :  responseDescription,
                "authorizationCode" : authorizationCode,
                "hostTransactionId" : hostTransactionId,
                merchantTransactionId
            },
            hostTimestamp 
        }
    } catch (error) {

       const errorMessage = getError(error);

       logger.debug(`ERROR PAYMENT: ${JSON.stringify(errorMessage)}`);

       authorizationResponse = {
        authorizationResponse: {
            "responseCode" : "9000",
            "responseReason" : "failed on payment",
            "responseDescription" : JSON.stringify(error),
            "authorizationCode" : "error",
            "hostTransactionId" : "error"
        }
            
        }
    }
        return authorizationResponse;
    }
 
 module.exports = {
    payment
 };
 