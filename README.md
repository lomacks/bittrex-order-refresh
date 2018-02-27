# bittrex-order-refresh

What is this?
---
A tool to periodically "refresh" (cancel and recreate) Bittrex limit orders to work around Bittrex's new policy of
automatically cancelling orders older than 28 days. Each time the program is run it will refresh orders older than a
threshold (14 days by default). It should be run periodically (e.g. every few days) to keep all orders up
to date.

*Important:* The tool attempts to identify and handle any potential errors, and also backs up the list of orders before
changing anything as an extra safeguard. However, it is a good idea to keep an eye on the output to ensure everything
worked as expected. I also can't be responsible for any unforeseen problems, so use this tool at your own risk.

The tool is open source and written in Node.js (JavaScript) so you can vet the source code. You just need to install the
Node.js runtime in order to use it - instructions below.


Installation & Usage
---

### Windows
* Download and install the Node.js Windows Installer package from https://nodejs.org/en/download/. The default settings
are fine.
* Download bittrex-order-refresh (this tool) from https://github.com/lomacks/bittrex-order-refresh/archive/master.zip and extract it somewhere.
* Double-click the `setup_windows` script to install dependencies.
* Generate a new API key on Bittrex and give it "read info" and "trade limit" permissions.
* Open `config.json` in *Wordpad* (Notepad can't handle these files properly) and fill in your new API key and secret key in the `credentials` section. Save and exit.

You can now start the tool by double-clicking the `run_windows` script. Do that every few days to keep your orders up to date.

### Mac OSX
* Download and install the Node.js Macintosh Installer package from https://nodejs.org/en/download/. The default settings
are fine.
* Download bittrex-order-refresh (this tool) from https://github.com/lomacks/bittrex-order-refresh/archive/master.zip and extract it somewhere.
* Double-click the `setup_osx.command` script to install dependencies.
* Generate a new API key on Bittrex and give it "read info" and "trade limit" permissions.
* Open `config.json` in TextEdit (or another editor) and fill in your new API key and secret key in the `credentials` section. Save and exit.

You can now start the tool by double-clicking the `run_osx` script. Do that every few days to keep your orders up to date.

What does it do?
---

### Refresh orders

The tool will identify any orders created more than 14 days ago (by default), and then cancel and recreate them. Only
limit buy and limit sell orders are supported (market orders are left alone). Partially-filled orders should be handled
correctly, and error-handling in the tool *should* be fairly robust - but keep an eye on the output.

### Restore from backup

The tool also has the ability to restore orders from one of the auto-generated backups, but this shouldn't be needed
under normal circumstances. If you do want to do this, usage is along the lines of:
```
npm start -- --purge-open-orders  # WARNING: This will cancel ALL currently open limit orders (to avoid duplicates when restoring)
npm start -- --restore-orders backups/backup-<date>.json  # This recreates all limit orders from the backup file
```

There is also a shell script, `util/csv-to-json.sh`, which may be useful for importing order lists from CSV files (e.g.
if you kept a manual backup of your open orders before Bittrex cancelled them).

### Sell Orders

The tool also has the ability to create new sell orders following a generic plan
```
node app.js --sell-order -c COIN_NAME -f INITIAL_BUY_IN_BTC
```

Example: Given Initial buy of 500 NCM at price of 0.001, rake = 0.5, cycleMultiplier: 2, numberOfCycles:4

the command node app.js --sell-order -c NCM -f 0.001 will produce the following sells:

SELL 250 NCM @ 0.002

SELL 125 NCM @ 0.004

SELL 62.5 NCM @ 0.008

SELL 31.25 NCM @ 0.016
