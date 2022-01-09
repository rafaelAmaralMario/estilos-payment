/*
 ** Copyright (c) 2021 Oracle and/or its affiliates.
 */


 const local = require('./config.json');

const getEnvironmentVariable = name => {
  return process.env[name] || local[name];
};

module.exports = {getEnvironmentVariable};
