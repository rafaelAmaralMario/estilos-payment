/*
 ** Copyright (c) 2021 Oracle and/or its affiliates.
 */

const axios = require('axios');
const https = require('https')
const nconf = require('nconf');


const local = require('./config.json');

const getEnvironmentVariable = name => {
  return process.env[name] || local[name];
};

const axiosRequest = axios.create({
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false
  })
});

const getProxyUrl = ()=> {
  return (
    nconf.get('general:proxy-server') ||
    process.env.env_https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY
  );
}
const getProxyWhitelist = () => {
  return (process.env.no_proxy || '').split(',').filter(Boolean);
}

module.exports = {getEnvironmentVariable, axiosRequest, getProxyUrl, getProxyWhitelist};
