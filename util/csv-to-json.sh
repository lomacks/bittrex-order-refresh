#!/bin/bash

# Convert a CSV of the following specification into a JSON backup file compatible with `app.js`'s --restore-orders function.
#   e.g.: ./csv-to-json.sh < orders.csv > orders.json
# Specification:
#   Comma-separated
#   No header row
#   Columns:
#     Market (e.g. "BTC-XRP")
#     Type (Either "LIMIT_BUY" or "LIMIT_SELL")
#     Price (e.g. "0.00001234")
#     Quantity (e.g. "500.25")
#
# *** Requires the `jq` utility
# *** See the README before using this script

while IFS=',' read -r market type price qty; do
  if [ "$market" ]; then
    printf '{ "Exchange": "%s", "OrderType": "%s", "Limit": "%s", "QuantityRemaining": "%s" }' "$market" "$type" "$price" "$qty"
    printf "\n"
  fi
done | jq -rs .

