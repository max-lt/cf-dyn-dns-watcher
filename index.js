#!/usr/bin/env node

const CloudflareDNSUpdater = module.exports = require('./lib');

const config = require('./config');

const cdu = new CloudflareDNSUpdater(config);

cdu.on('error', (err) => {
    // stop on error
    console.error('Error:', err);
    process.exit(1);
});

cdu.startWatcher();
