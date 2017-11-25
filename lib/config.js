/*jshint node: true, asi: true */
'use strict'

var fs = require('fs'),
    path = require('path'),
    stripJsonComments = require('strip-json-comments'),
    _ = require('lodash')

var load = function (basePath, fn, optional) {
    var configPath = path.resolve(basePath, fn)
    if (fs.existsSync(configPath)) {
        return JSON.parse(stripJsonComments(fs.readFileSync(configPath, 'utf8')))
    } else if (optional) {
        return {}
    } else {
        throw new Error('Required config file not present: ' + fn)
    }
}

var basePath = path.dirname(require.main.filename)
var config = _.merge(
    load(basePath, 'config.json', false),
    load(basePath, 'config_local.json', true)
)

module.exports = config
