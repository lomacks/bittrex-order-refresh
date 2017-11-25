/*jshint node: true, asi: true */
'use strict'

var winston = require('winston')

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      json: false,
      timestamp: true,
      handleExceptions: true,
      colorize: true,
      prettyPrint: true
    })
  ],
  exitOnError: true,
  level: 'debug'
})

// Alias trace ==> silly
logger.trace = logger.silly

module.exports = logger
