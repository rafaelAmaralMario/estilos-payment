/*
 ** Copyright (c) 2021 Oracle and/or its affiliates.
 */
/* eslint-disable camelcase */

const axios = require('axios');
const express = require('express');
const router = new express.Router();
const { getPayment } = require("./services/niubiz")
const { getCardData, getTarifario, getInstallments, getTransactionEstilosCard } = require("./services/tarjeta-estilos")
const { getEnvironmentVariable } = require("./config")
let sunatSequential=9000;

const { LogFactory } = require('../logger')

// routes

// niubiz
router.post('/v1/payment', async (req, res) => {
  'use strict';
  const { orderId, currencyCode, transactionId, paymentId, amount, transactionType, transactionTimestamp, gatewayId, paymentMethod, customProperties, billingAddress, cardDetails } = req.body;


  // Logs path for this SSE is in root path /logs
  const logger = LogFactory.logger();
  logger.debug(`Starting Payment request: ${JSON.stringify(req.body)}`);

  try {
    let response = {};
    const { cardAccount="", cardNumber="", cardPassword="1234", tipoDeferido = "1", installments="1", dniCustomerCode="", products, payment, FormaPago="3",paymentType } = customProperties;
    const parsedProducts = JSON.parse(products);
    const parsedPayment = JSON.parse(payment);

    if (paymentType === "TarjetaEstilos") {

      const estilosCardRequest = {
        cardAccount, 
        cardNumber, 
        cardPassword, 
        billDate: transactionTimestamp, 
        tipoDeferido, 
        installments, 
        dniCustomerCode, 
        products : parsedProducts, 
        payment: parsedPayment, 
        FormaPago, 
        billingAddress,
        sunatSequential,
        orderId,
        paymentType
      }
      
      response = await getTransactionEstilosCard(estilosCardRequest);
    } else {
      logger.debug(`Request Niubiz Flow: ${JSON.stringify(req.body)}`);
      response = await getPayment(req.body);
      const estilosCardRequest = {
        cardAccount: "", 
        cardNumber: "6010100103000009", 
        cardPassword: "1234", 
        billDate: transactionTimestamp, 
        tipoDeferido: "1", 
        installments: "1", 
        dniCustomerCode: dniCustomerCode, 
        products : parsedProducts, 
        payment: parsedPayment,
        FormaPago : "3", 
        billingAddress,
        sunatSequential,
        isNiubiz: true,
        orderId
      }
      try {
        const transactionResponse = await getTransactionEstilosCard(estilosCardRequest);
        if(transactionResponse.authorizationResponse.responseCode === "9000") {
          response.additionalProperties["tarjetaEstilosErrorMessage"] = transactionResponse.authorizationResponse.responseReason;
        } else {
          response.additionalProperties["tarjetaEstilos"] = transactionResponse;
        }
      } catch (error) {
        response.additionalProperties["tarjetaEstilosErrorMessage"] = error.authorizationResponse.responseReason;
      }


      logger.debug(`Request Niubiz completed`);

    }

    sunatSequential= Number(sunatSequential)+1
    logger.debug(`Request completed: ${JSON.stringify(response.additionalProperties)}`);

    return res.status(200).json({
      "orderId": orderId,
      "currencyCode": currencyCode,
      "transactionId": transactionId,
      "paymentId": paymentId,
      "amount": amount,
      "transactionType": transactionType,
      "hostTransactionTimestamp": response.hostTimestamp,
      "transactionTimestamp": transactionTimestamp,
      "paymentMethod": paymentMethod,
      "gatewayId": gatewayId,
      authorizationResponse: response.authorizationResponse,
      additionalProperties: response.additionalProperties
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

router.post('/v1/tarjeta-estilos/get-data', async (req, res) => {
  'use strict';
  const logger = LogFactory.logger();
  logger.debug(`Request getCardData: ${JSON.stringify(req.body)}`);

  try {
    const data = await getCardData(req.body);

    if (data.hasError) {
      return res.status(400).json(data);
    }

    logger.debug(`Card Data Success`);

    return res.status(200).json(data)

  } catch (error) {
    return res.status(400).json(error)
  }

});

router.post('/v1/tarjeta-estilos/installments', async (req, res) => {
  'use strict';
  const logger = LogFactory.logger();
  logger.debug(`Request installments: ${JSON.stringify(req.body)}`);

  try {
    const data = await getInstallments(req.body);

    if (data.hasError) {
      return res.status(400).json(data);
    }

    logger.debug(`Installments Success`);

    return res.status(200).json(data)

  } catch (error) {
    return res.status(400).json(error)
  }
});

router.post('/v1/tarjeta-estilos/tarifario', async (req, res) => {
  'use strict';
  const logger = LogFactory.logger();
  logger.debug(`Request Tarifario: ${JSON.stringify(req.body)}`);

  try {
    const { tarjeta } = req.body

    const data = await getTarifario(tarjeta);

    logger.debug(`Tarifario Success`);

    return res.status(200).json(data)

  } catch (error) {
    return res.status(400).json(error)
  }
});

module.exports = router;
