# bittrex-order-refresh

What?
---
A tool to periodically "refresh" (cancel and recreate) Bittrex limit orders to work around Bittrex's new policy of
automatically cancelling orders older than 28 days. Each time the program is run it will refresh orders older than a
threshold (14 days by default). It should be run periodically (e.g. every day, or every few days) to keep all orders up
to date.

*Important:* The tool attempts to identify and handle any potential errors, and also backs up the list of orders before
changing anything as an extra safeguard. However, it is a good idea to keep an eye on the output to ensure everything
worked as expected. I also can't be responsible for any unforeseen problems, so use this tool at your own risk.

Installation of this tool is a bit technical at the moment, but I will be adding some scripts / packaging to simplify
this next.

Installation
---

### Prerequisites
* Node.js
* NPM

### Configuration
* Run `npm install` to download library dependencies.
* Create a new API key on Bittrex and give it "read info" and "trade limit" permissions ONLY.
* Add the API key and secret to `config.json`.

Usage
---

### Refresh orders

Run `npm start`.

The tool will identify any orders created more than 14 days ago (by default), and then cancel and recreate them. Only
limit buy and limit sell orders are supported (market orders are left alone). Partially-filled orders should be handled
correctly, and error-handling in the tool *should* be fairly robust - but keep an eye on the output.

### Restore from backup

The tool also has the ability to restore orders from one of the auto-generated backups, but this shouldn't be needed
under normal circumstances. If you do want to do this, usage is along the lines of:
```
npm start -- --purge-open-orders  # WARNING: This will cancel ALL currently open limit orders (to avoid duplicates)
npm start -- --restore-orders backups/backup-<date>.json  # This recreates all limit orders listed in the backup file
```
