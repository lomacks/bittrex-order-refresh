/*jshint node: true, asi: true */
'use strict'

var config = require('./lib/config'),
    logger = require('./lib/logger'),
    //bittrex = require('node-bittrex-api'),    // See comment at the top of lib/node_bittrex_api-0.7.8-PATCHED.js
    bittrex = require('./lib/node_bittrex_api-0.7.8-PATCHED'),
    _ = require('lodash'),
    program = require('commander'),
    util = require('util'),
    moment = require('moment'),
    jsonfile = require('jsonfile'),
    async = require('async')

// Command line args for special recovery mode functions; not needed in normal operation
program
    .option('--purge-open-orders', 'Cancel ALL open limit orders, and exit (CAUTION)')
    .option('--restore-orders <file>', 'Restore limit orders from the specified backup file, and exit')
    .parse(process.argv)

bittrex.options({
    'apikey': config.credentials.key,
    'apisecret': config.credentials.secret,
    'stream': false,
    'verbose': false,
    'cleartext': false,
    'inverse_callback_arguments': true
})

// Cancel an order, and wait for it to finish cancelling
var doCancelOrder = function(uuid, cb) {
    bittrex.cancel({uuid: uuid}, function(err, data) {
        if (err || !data.success) {
            logger.warn('Failed to cancel order %s: %s; %j; skipping...', uuid, data ? data.message : '', err)
            cb(new Error())  // continue with next
            return
        }

        /* Wait a short period before replacing the order to give it time to cancel, then verify that it has
         * finished cancelling before placing the new order. */
        var getOrder = function() {
            bittrex.getorder({uuid: uuid}, getOrderCb)
        }
        var getOrderCb = function(err, data) {
            if (err || !data.success || !data.result) {
                logger.warn('Checking order %s failed: %s; %j; will retry...', uuid, data ? data.message : '', err)
                setTimeout(getOrder, config.retryPeriodMs)
                cb(new Error())
                return
            }
            if (data.result.IsOpen) {
                logger.debug('Cancellation still pending for order %s; will retry...', uuid)
                setTimeout(getOrder, config.retryPeriodMs)
                cb(new Error())
                return
            }

            cb()
        }
        setTimeout(getOrder, config.retryPeriodMs)
    })
}

// Create a new limit order
var doCreateOrder = function(newOrderType, newOrder, cb) {
    var createOrder = function() {
        if (newOrderType === 'LIMIT_BUY')
            bittrex.buylimit(newOrder, createOrderCb)
        else if (newOrderType === 'LIMIT_SELL')
            bittrex.selllimit(newOrder, createOrderCb)
        else
            throw new Error('Unhandled order type: ' + newOrderType)
    }
    var createOrderCb = function(err, data) {
        if (err || !data.success) {
            logger.warn('Failed to create replacement %s order, %j: %s; %j; will retry...', newOrderType, newOrder, data ? data.message : '', err)
            setTimeout(createOrder, config.retryPeriodMs)
            cb(new Error())
            return
        }

        cb(null, data.result.uuid)
    }
    setTimeout(createOrder, 0)
}

bittrex.getopenorders({}, function(err, data) {
    if (err || !data.success) {
        logger.error('Failed to get open orders: %s; %j', data ? data.message : '', err)
        return  // fatal
    }

    var now = new Date()
    var orders = data.result
    var limitOrders = _.filter(orders, o => {
        return (o.OrderType === 'LIMIT_BUY' || o.OrderType === 'LIMIT_SELL')
    })
    logger.info('You have %d open orders, of which %d are limit orders.',
        orders.length, limitOrders.length)

    // *** Recovery functions - not part of normal operation; see the README
    if (program.purgeOpenOrders) {
        logger.warn('Cancelling %d open limit orders...', limitOrders.length)
        async.mapLimit(limitOrders, config.concurrentTasks, function (o, cb) {
            var uuid = o.OrderUuid
            doCancelOrder(uuid, function(err) {
                if (!err)
                    logger.debug('Order %s cancelled.', uuid)
                cb()
            })
        })
        return  // exit
    } else if (program.restoreOrders) {
        var restoreOrders = jsonfile.readFileSync(program.restoreOrders)
        logger.warn('Restoring %d limit orders from backup...', restoreOrders.length)
        async.mapLimit(restoreOrders, config.concurrentTasks, function (o, cb) {
            var newOrderType = o.OrderType
            var newOrder = {
                market: o.Exchange,
                quantity: o.QuantityRemaining,
                rate: o.Limit
            }

            logger.debug('Creating %s order: %j', newOrderType, newOrder)
            doCreateOrder(newOrderType, newOrder, function(err, newUuid) {
                if (!err)
                    logger.debug('Order %s created.', newUuid)
                cb()
            })
        })
        return  // exit
    }

    // *** Normal operation - backup current open limit orders, then refresh "stale" orders

    var backupFile = util.format(
        config.backupFile,
        moment().utc().format('YYYYMMDDHHmmss') + 'Z' // literal Zulu TZ flag, since it's UTC
    )
    jsonfile.writeFileSync(backupFile, limitOrders, { spaces: 2 })
    logger.info('All current limit orders backed up to file: %s', backupFile)

    var staleOrders;
    if (config.replaceAllOrders) {
        staleOrders = orders
        logger.info('Replacing all limit orders (replaceAllOrders == true)...')
    } else {
        staleOrders = _.filter(limitOrders, o => {
            var orderTs = Date.parse(o.Opened)
            var deltaMs = now - orderTs
            var deltaDays = (((deltaMs / 1000) / 60) / 60 ) / 24
            return deltaDays > config.maxOrderAgeDays
        })
        logger.info('%d limit orders older than %d days are old enough to be replaced...',
            staleOrders.length, config.maxOrderAgeDays)
        
        var sampleSize = (staleOrders.length * (config.percentToReplaceEachRun / 100)) + 1   // Always do at least 1
        staleOrders = _.sampleSize(staleOrders, sampleSize)
        logger.warn('Of those, %d%% (%d limit orders) will be replaced this time around...',
            config.percentToReplaceEachRun, staleOrders.length)
    }

    var staleOrderCount = staleOrders.length
    if (staleOrderCount <= 0) {
        logger.info('Nothing to do.')
        return
    }

    async.mapLimit(staleOrders, config.concurrentTasks, function (o, cb) {
        var uuid = o.OrderUuid
        var newOrderType = o.OrderType
        var newOrder = {
            market: o.Exchange,
            quantity: o.QuantityRemaining,
            rate: o.Limit
        }

        logger.debug('Replacing order %s with new %s order: %j', uuid, newOrderType, newOrder)
        doCancelOrder(uuid, function(err) {
            if (!err) {
                // Order has been cancelled; create the replacement order
                doCreateOrder(newOrderType, newOrder, function(err, newUuid) {
                    if (!err)
                       logger.debug('Order %s replaced by new order %s.', uuid, newUuid)
                    cb()
                })
            } else {
                // else, skip it this run
                cb()
            }
        })
    })

})
