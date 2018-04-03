const http = require('http');
const EE = require('events').EventEmitter;
const cf = require('cloudflare');

const Joi = require('joi');

const configSchema = Joi.object().keys({
  interval: Joi.number().integer().min(1000).optional().allow(null),
  cf: Joi.object().keys({
    email: Joi.string().required(),
    key: Joi.string().required(),
    zone: Joi.string().required(),
    target: Joi.object().keys({
      id: Joi.string(),
      type: Joi.string(),
      name: Joi.string()
    }).or('id', ['type', 'name']).with('type', 'name').with('name', 'type').required()
  }).required()
});

/**
 * @typedef {{
  * id: string,
  * type: string,
  * content: string ,
  * ttl: number,
  * proxiable: boolean,
  * proxied: boolean,
  * locked: boolean,
  * zone_id: string,
  * zone_name string,
  * content string
 * }} CloudflareTarget
 */

function fatal(error) {
  console.error('Fatal:', error);
  process.exit(1);
}

/**
 * @extends EventEmitter
 */
class CloudflareDNSUpdater extends EE {

  constructor(config = {}) {
    super();

    // Check config object
    if (typeof config !== 'object')
      throw new Error('Invalid config object');

    const validation = configSchema.validate(config);

    if (validation.error)
      return fatal(validation.error);

    this.config = Object.assign({}, {interval: 60 * 1000}, config);

    this._cf = cf({
      email: config.cf.email,
      key: config.cf.key,
    });

    // Check config.interval
    if (config.interval < 1001)
      throw new Error('Interval must be greater than 1000');

    if (config.interval && !Number.isInteger(config.interval))
      throw new Error('Interval must be an integer');

    console.log(`Interval set to ${this.config.interval} ms`);

    this.apiKey = config && config.apiKey;
  }

  startWatcher() {
    let pending = false;

    const _check = () => {
      console.log(`${(new Date).toISOString()}: checking for ip change, current is`, this._currentIP);
      if (pending) return;
      pending = true;
      return this.checkIP()
        .then((ip) => {
          if (!this._currentIP) // first time in loop
            return this.initializeIP(ip);
          if (this._currentIP === ip)
            return console.log(`No change detected.`);
          return this.updateIP(ip, this._currentIP, 'current ip')
        })
        .catch((e) => this.emit('error', e))
        .then(() => pending = false)
    };

    (async () => {
      await _check();

      this._interval = setInterval(_check, this.config.interval);
    })();
  };

  stopWatcher() {
    clearInterval(this._interval);
  }

  checkIP() {
    return new Promise((resolve, reject) => {
      const req = http.get('http://api.ipify.org', (res) => {
        const length = res.headers && res.headers['content-length'];
        if (!length)
          return reject(new Error('Expected Content-Length header'));
        if (length > 254)
          return reject(new Error('Unexpected Content-Length value: ' + length));

        let rawData = '';

        res.on('data', (chunk) => rawData += chunk);

        res.on('end', (chunk) => {
          rawData += chunk;
          const match = /(\d+\.\d+\.\d+\.\d+)/.exec(rawData);
          if (!match || !match[1])
            return reject(new Error(`Cannot match ip with "${rawData}"`));

          resolve(match[1]);
        });
      });
      req.on('error', (error) => reject(error));
    })
  }

  async updateIP(ip, oldIp, reason) {
    const cf = this._cf;

    console.log(`IP change detected, from ${oldIp} to ${ip} (${reason})`);

    /** @type CloudflareTarget */
    const target = this._target;

    if (!target)
      fatal(Error('Trying to update an undefined target'));

    const {zone_id, id, type, name, ttl, proxied} = target;

    const resp = await cf.dnsRecords.edit(zone_id, id, Object.assign({}, {type, name, ttl, proxied}, {content: ip}));

    console.log(`Target updated to ${JSON.stringify(resp.result, null, 2)}`);

    this._currentIP = ip;
  }

  async initializeIP(ip) {
    const cf = this._cf;
    this._currentIP = ip;
    console.log(`IP address initially set to ${this._currentIP}`);
    const resp = await cf.dnsRecords.browse(this.config.cf.zone);
    const target = this.config.cf.target;

    function matchTarget(element) {
      if (target.id)
        return element.id === target.id;
      else if (target.name && target.type)
        return element.name === target.name && element.type === target.type;
    }

    const match = resp.result.filter(matchTarget);

    if (match.length > 1)
      return fatal(Error('Too many matches for target'));

    if (match.length !== 1)
      return fatal(Error('No match for target'));

    this._target = match[0];

    console.log(`Remote target set to ${JSON.stringify(this._target, null, 2)}`);

    // If current cloudflare target is not up to date
    if (this._target.content !== ip) {
      return this.updateIP(ip, this._target.content, 'target.content');
    } else {
      console.log('Remote content up to date.');
    }
  }
}

/**
 * @type {CloudflareDNSUpdater}
 */
module.exports = CloudflareDNSUpdater;
