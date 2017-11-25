/*jshint node: true, asi: true */
'use strict'

var config = require('./lib/config'),
    logger = require('./lib/logger'),
    bittrex = require('node-bittrex-api'),
    _ = require('lodash')

bittrex.options({
    'apikey': config.credentials.key,
    'apisecret': config.credentials.secret,
    'stream': false,
    'verbose': false,
    'cleartext': false,
    'inverse_callback_arguments': true
})

bittrex.getopenorders({}, function(err, data) {
    if (err || !data.success) {
        logger.error('Failed to get open orders: %s; %j', data.message, err)
        return  // fatal
    }

    var now = new Date()
    var orders = data.result
    var limitOrders = _.filter(orders, o => {
        return (o.OrderType === 'LIMIT_BUY' || o.OrderType === 'LIMIT_SELL')
    })
    logger.info('You have %d open orders, of which %d are limit orders.',
        orders.length, limitOrders.length)

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
        logger.info('%d limit orders are older than %d days and will be replaced...',
            staleOrders.length, config.maxOrderAgeDays)
    }

    var staleOrderCount = staleOrders.length
    var replacedCount = 0

    _.forEach(staleOrders, o => {
        var uuid = o.OrderUuid
        var newOrderType = o.OrderType
        var newOrder = {
            market: o.Exchange,
            quantity: o.QuantityRemaining,
            rate: o.Limit
        }

        logger.debug('Replacing order %s with new %s order: %j', uuid, newOrderType, newOrder)
        bittrex.cancel({uuid: uuid}, function(err, data) {
            if (err || !data.success) {
                logger.error('Failed to cancel order %s: %s; %j', uuid, data.message, err)
                return  // continue with next
            }

            /* Wait a short period before replacing the order to give it time to cancel, then verify that it has
             * finished cancelling before placing the new order. */
            var getOrder = function() {
                bittrex.getorder({uuid: uuid}, getOrderCb)
            }
            var getOrderCb = function(err, data) {
                if (err || !data.success || !data.result) {
                    logger.warn('Checking order %s failed: %s; %j; will retry...', uuid, data.message, err)
                    setTimeout(getOrder, config.retryPeriodMs)
                    return
                }
                if (data.result.IsOpen) {
                    logger.debug('Cancellation still pending for order %s; will retry...', uuid)
                    setTimeout(getOrder, config.retryPeriodMs)
                    return
                }

                // Order has been cancelled; create the replacement order
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
                        logger.warn('Failed to create replacement %s order, %j: %s; %j; will retry...', newOrderType, newOrder, data.message, err)
                        setTimeout(createOrder, config.retryPeriodMs)
                        return
                    }

                    logger.debug('Order %s replaced by new order %s.', uuid, data.result.uuid)
                    if (++replacedCount /* atomic */ >= staleOrderCount)
                        logger.info('Complete; replaced %d/%d orders.', replacedCount, staleOrderCount)
                }
                setTimeout(createOrder, 0)
            }
            setTimeout(getOrder, config.retryPeriodMs)
        })
    })

})
