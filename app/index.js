/*
 ** Copyright (c) 2021 Oracle and/or its affiliates.
 */
/* eslint-disable camelcase */

const express = require('express');
const router = new express.Router();
const {payment} = require("./services/niubiz")

const {LogFactory} = require('../logger')



// routes
router.post('/v1/payment', async (req, res) => {
  'use strict';
  const {orderId,currencyCode,transactionId,paymentId,amount,transactionType,transactionTimestamp, gatewayId, paymentMethod} = req.body;

  // Logs path for this SSE is in root path /logs
  const logger = LogFactory.logger();
  logger.debug(`Request Route: ${JSON.stringify(req.body)}`);


  try {

    const response = await payment(req.body)
    logger.debug(`Request authorizationResponse: ${JSON.stringify(response)}`);
    logger.debug(`Request authorizationResponse: ${JSON.stringify({
      "orderId"           : orderId,
      "currencyCode"      : currencyCode,
      "transactionId"     : transactionId,
      "paymentId"         : paymentId,
      "amount"            : amount,
      "transactionType"   : transactionType,
      "hostTransactionTimestamp"  : response.hostTimestamp,
      "transactionTimestamp"      : transactionTimestamp,
      "paymentMethod"             : paymentMethod,
      "gatewayId"                 : gatewayId,
      authorizationResponse : response.authorizationResponse
    })}`);

    return res.status(200).json({
      "orderId"           : orderId,
      "currencyCode"      : currencyCode,
      "transactionId"     : transactionId,
      "paymentId"         : paymentId,
      "amount"            : amount,
      "transactionType"   : transactionType,
      "hostTransactionTimestamp"  : response.hostTimestamp,
      "transactionTimestamp"      : transactionTimestamp,
      "paymentMethod"             : paymentMethod,
      "gatewayId"                 : gatewayId,
      authorizationResponse : response.authorizationResponse
    })

  } catch (error) {

      logger.debug(`Error Route: ${error.message}`);
      logger.debug(`Request Body: ${JSON.stringify(req.body)}`);

       return res.status(200).json(
      {
        "orderId": orderId,
        "currencyCode": currencyCode,
        "transactionId": transactionId,
        "paymentId": paymentId,
        "amount": amount,
        "transactionType": transactionType,
        "hostTransactionTimestamp": Date.now().toString(),
        "transactionTimestamp": transactionTimestamp,
        "paymentMethod": "card",
        "gatewayId": gatewayId,
        "authorizationResponse": {
             "responseCode": "9000",
             "responseReason": "ERROR IN CATCH",
             "responseDescription": error.message,
             "authorizationCode": transactionId,
             "hostTransactionId": transactionId
        }
   }
    );
  }
});


module.exports = router;
