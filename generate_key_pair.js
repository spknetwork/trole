const dhive = require('@hiveio/dhive');
const Crypto = require('crypto')
let opts = {};
opts.addressPrefix = 'STM';
const rando = Crypto.getRandomValues(new Uint16Array(32))
const ownerKey = dhive.PrivateKey.fromLogin('thestandarduser', rando, 'spk');
console.log(ownerKey.toString(), ownerKey.createPublic(opts.addressPrefix).toString())
process.exit()
