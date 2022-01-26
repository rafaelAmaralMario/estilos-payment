/*
 ** Copyright (c) 2021 Oracle and/or its affiliates.
 */

const axios = require('axios');
const https = require('https')
const fs = require('fs')

const local = require('./config.json');

const getEnvironmentVariable = name => {
  return process.env[name] || local[name];
};

const axiosRequest = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

module.exports = {getEnvironmentVariable, axiosRequest};
