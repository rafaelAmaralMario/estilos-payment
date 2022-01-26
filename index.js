const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const {LogFactory} = require('./logger');

const logger = LogFactory.logger();

app.use(bodyParser.urlencoded({ extended: true })); 
app.use(bodyParser.json());

app.use(function(req, res, next) {
  'use strict';
  if (!res.locals) {
    res.locals = {};
  }
  //http://expressjs.com/en/api.html#res.locals
  //use res.locals to pass object between main and sub apps
  res.locals.logger = logger;
  next();
});


process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;
app.use("/ccstorex/custom", require("./app/index"));

// Read port from command line, config, or default
var port = (process.env.PORT || process.argv[2] || (process.env.npm_package_config_port || 3000));

app.listen(port, function () {
  'use strict';
  logger.info('Listening on port ' + port +'...');
  logger.debug('Debug : Listening on port ' + port +'...');
});
