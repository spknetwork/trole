const fetch = require("node-fetch");
const hiveTx = require("hive-tx")
const diskusage = require('diskusage');
const config = require('./config')
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: config.dbcs,
});
const fs = require('fs-extra')
// if directory ./db/ does not exist, create it
if (!fs.existsSync('./db/')) {
  fs.mkdirSync('./db/');
}
var { exec } = require('child_process');
const { Blob } = require("buffer");
const getFilePath = (fileCid, contract) => `./uploads/${fileCid}-${contract}`
const Ipfs = require('ipfs-api')
var ipfs = new Ipfs(`/ip4/${config.ENDPOINT}/tcp/${config.ENDPORT}`)
const Busboy = require('busboy');

var live_stats = {
  i: parseInt(Math.random() * 10),
  feed: 0
}
ipfs.id().then(r => {
  live_stats.ipfsid = r.id
  exec(`node register_node.js`, (error, stdout, stderr) => {
    console.log(stdout)
    if (error) {
      console.log(`error: ${error.message}`);
      return;
    }
  })
}).catch(e => console.log(e))

var lock = {}
var ipfsLock = {}

const DB = {
  getKeys: function (type = 'contracts') {
    return new Promise((res, rej) => {
      fs.readdir(`./db/`, (err, files) => {
        if (err) {
          console.log('Failed to read:', type)
          rej(err)
        } else {
          switch (type) {
            case 'contracts':
              for (var i = 0; i < files.length; i++) {
                if (files[i].indexOf('.json') < 0) {
                  files.splice(i, 1)
                  i--
                } else {
                  files[i] = files[i].replace('.json', '')
                }
              }
              break;
            case 'flags':
              for (var i = 0; i < files.length; i++) {
                if (files[i].indexOf('.flag') < 0) {
                  files.splice(i, 1)
                  i--
                }
              }
              break;
            default:
              break;
          }
          res(files)
        }
      });
    })
  },
  read: function (key) {
    return new Promise((res, rej) => {
      fs.readJSON(`./db/${key}.json`)
        .then(json => res(json))
        .catch(e => {
          res(JSON.stringify({}))
        })
    })
  },
  write: function (key, value) {
    if (lock[key]) {
      return new Promise((res, rej) => {
        setTimeout(() => {
          DB.write(key, value).then(json => res(json)).catch(e => rej(e))
        }, 100)
      })
    }
    return new Promise((res, rej) => {
      lock[key] = true
      fs.writeJSON(`./db/${key}.json`, value)
        .then(json => {
          delete lock[key]
          res(json)
        })
        .catch(e => {
          delete lock[key]
          console.log('Failed to read:', key)
          rej(e)
        })
    })
  },
  delete: function (key) {
    return new Promise((res, rej) => {
      fs.remove(`./db/${key}.json`)
        .then(json => {
          console.log('deleted', key)
          res(json)
        })
        .catch(e => {
          console.log('Failed to delete:', key)
          rej(e)
        })
    })
  },
  update: function (key, att, value) {
    return new Promise((res, rej) => {
      fs.readJSON(`./db/${key}.json`)
        .then(json => {
          json[att] = value
          fs.writeJSONSync(`./db/${key}.json`, json)
            .then(json => res(json))
            .catch(e => {
              console.log('Failed to update:', key)
              rej(e)
            })
        })
        .catch(e => {
          console.log('Failed to update:', key)
          rej(e)
        })
    })
  }
}

getStats()

function getStats() {
  live_stats.i = (live_stats.i + 1) % 10
  console.log('Clean: ' + live_stats.i)
  inventory()
  fetch(`${config.SPK_API}/feed${live_stats.feed ? '/' + live_stats.feed : ''}`).then(rz => rz.json()).then(json => {
    const feed = json.feed
    const keys = Object.keys(json.feed)
    const stored = `@${config.account} Stored`
    const deleted = `@${config.account} Removed`
    for (var i = 0; i < keys.length; i++) {
      if (parseInt(keys[i].split(':')[0]) > live_stats.feed) live_stats.feed = parseInt(keys[i].split(':')[0])
      if (feed[keys[i]].search(stored) > -1) {
        storeByContract(feed[keys[i]].split('|')[1])
      } else if (feed[keys[i]].search(deleted) > -1) {
        deleteByContract(feed[keys[i]].split('|')[1])
      }
    }
  })
  fetch(`${config.SPK_API}/@${config.account}`).then(rz => rz.json()).then(json => {
    const keys = Object.keys(json)
    for (var i = 0; i < keys.length; i++) {
      live_stats[keys[i]] = json[keys[i]]
    }
  })
  ipfs.repo.stat((err, stats) => {
    live_stats.storageMax = BigInt(stats.storageMax)
    live_stats.repoSize = BigInt(stats.repoSize)
    live_stats.numObjects = BigInt(stats.numObjects)
  })
  if (!live_stats.head_block) return setTimeout(getStats, 3 * 1000)
  fs.readdir(`./uploads/`, (err, files) => {
    files.forEach(file => {
      const keys = file.split(':')
      const block = parseInt(keys[keys.length - 1])
      if (live_stats['head_block'] > block + 28800) {
        fs.remove(`./uploads/${file}`)
      }
    });
  });
  fs.readdir(`./db/`, (err, files) => {
    files.forEach(file => {
      const key = file.replace('.json', "")
      // return final char in key
      const block = parseInt(key[key.length - 1])
      if (live_stats.i == block) {
        DB.read(key).then(json => {
          try {
            json = JSON.parse(json)
          } catch (e) {
            console.log('Parse Error')
          }
          getActiveContract(key).then(contract => {
            const behind = contract[1].behind
            contract = contract[1].result
            if (contract == 'Contract Not Found') {
              if (behind < 100) {
                DB.delete(key)
                for (var i = 0; i < json.df.length; i++) {
                  fs.remove(getFilePath(json.df[i], key))
                  ipfsUnpin(json.df[i])
                  console.log('unpinning', json.df[i])
                }
              }
            } else {
              if (behind < 100) {
                var isMine = 0
                const nodes = contract.n ? Object.keys(contract.n) : []
                for (var j = 1; j <= nodes.length; i++) {
                  if (contract.n[`${j}`] == config.account) {
                    isMine = j
                    break
                  }
                }
                if (isMine == 0) { //or j > p + threshold
                  for (var i = 0; i < json.df.length; i++) {
                    fs.remove(getFilePath(json.df[i], key))
                    ipfsUnpin(json.df[i])
                    console.log('unpinning', json.df[i])
                  }
                  DB.delete(key).then(d => {
                    console.log('deleted', key + '.json')
                  })
                }
              }
            }
          }).catch(e => {
            console.log(e)
          })
        })
      }
    });
  });
  setTimeout(getStats, 1 * 60 * 1000) // 10 minutes
}

function ipfsUnpin(cid) {
  return new Promise((res, rej) => {
    if (cid) ipfs.pin.rm(cid, (err, pinset) => {
      if (err) return rej(err)
      res(pinset)
    })
    else res('Not Pinned')
  })
}

function inventory() {
  DB.getKeys('contracts').then(keys => {
    for (var i = 0; i < keys.length; i++) {
      DB.read(keys[i]).then(contract => {
        contract = JSON.parse(contract)
        for (var j in contract.df) {
          ipfs.pin.ls(j, (err, pinset) => {
            if (err && j) {
              try {
                if (j.length < 10) {
                  //console.log('contract failure artifact, deleting', contract.i)
                } else {
                  console.log('missing', j)
                  ipfs.pin.add(j, function (err, pin) {
                    if (err) {
                      console.log(err);
                    }
                    console.log(`pinned ${j}`)
                  })
                }
              } catch (e) {
                console.log(e)
              }
            } else if (!j) {
              console.log('missing', j)
              //
            }
            // setTimeout(() => { // slow it down, make a queue function
            //   console.log('inventory', contract.df[j])
            // })
          })
        }
      })
    }
  })
}

function localIpfsUpload(cid, contractID) {
  return new Promise((res, rej) => {
    // Use a lock to prevent concurrent contract updates
    if (ipfsLock[contractID]) {
      return setTimeout(() => {
        localIpfsUpload(cid, contractID).then(r => res(r)).catch(e => rej(e))
      }, 100)
    }
    ipfsLock[contractID] = true

    DB.read(contractID)
      .then(str => {
        var contract = JSON.parse(str)
        ipfs.files.add(fs.readFileSync(getFilePath(cid, contract.id)), function (err, file) {
          if (err) {
            delete lock[contractID]
            console.log('File add Error: ', err);
            return res({ status: 500, message: 'IPFS Add Error' })
          }

          if (str.indexOf(file[0].hash) > 0) {
            console.log('lIu', contract.t, file[0].size, contract.s)
            if (contract.t + file[0].size <= contract.s) {
              ipfs.pin.add(cid, function (err, pin) {
                if (err) {
                  delete lock[contractID]
                  console.log(err);
                  return res({ status: 410, message: 'Internal Error' })
                }
                console.log(`pinned ${cid}`)

                // Re-read contract to get latest state
                DB.read(contractID)
                  .then(str => {
                    contract = JSON.parse(str)
                    contract[cid] = file[0].size
                    contract.t = (contract.t || 0) + file[0].size // Update total size

                    DB.write(contract.id, JSON.stringify(contract))
                      .then(json => {
                        console.log('signNupdate', contract)
                        var allDone = true
                        for (var i = 0; i < contract.df.length; i++) {
                          console.log('DiF', contract.df[i], contract[contract.df[i]], cid, i)
                          if (!contract[contract.df[i]]) {
                            console.log("missing:", contract[contract.df[i]])
                            allDone = false
                            break
                          }
                        }

                        if (allDone) {
                          console.log('allDone')
                          signNupdate(contract)
                          // Delete files only after all uploads complete
                          for (var i = 0; i < contract.df.length; i++) {
                            try {
                              fs.rmSync(getFilePath(contract.df[i], contract.id))
                            } catch (e) {
                              console.log('Error removing file:', e)
                            }
                          }
                        }

                        delete ipfsLock[contractID]
                        res({ status: 200, message: 'Success' })
                      })
                      .catch(err => {
                        delete ipfsLock[contractID]
                        res({ status: 500, message: 'Contract Write Error' })
                      })
                  })
                  .catch(err => {
                    delete ipfsLock[contractID]
                    res({ status: 500, message: 'Contract Read Error' })
                  })
              })
            } else {
              console.log(`Files larger than contract: ${file[0].hash}`)
              fs.rmSync(getFilePath(cid, contract.id))
              DB.delete(contract.id)
              delete ipfsLock[contractID]
              res({ status: 400, message: 'File Size Exceeded' })
            }
          } else {
            console.log(`mismatch between ${cid} and ${file[0].hash}`)
            fs.rmSync(getFilePath(cid, contract.id))
            fs.createWriteStream(
              getFilePath(cid, contract.id), { flags: 'w' }
            );
            delete ipfsLock[contractID]
            res({ status: 400, message: 'File CID Mismatch' })
          }
        })
      })
      .catch(err => {
        delete ipfsLock[contractID]
        res({ status: 500, message: 'Initial Contract Read Error' })
      })
  })
}

exports.storageStats = (req, res, next) => {
  // Check disk usage for the current working directory
  diskusage.check(process.cwd(), (err, info) => {
    if (err) {
      console.error('Error getting disk usage:', err);
      return res.status(500).json({ message: 'Error retrieving disk usage' });
    }

    // Convert disk usage numbers to BigInt for consistency with IPFS stats
    const total = BigInt(info.total);
    const free = BigInt(info.free);
    const used = total - free;

    // Get the number of active contracts
    DB.getKeys('contracts')
      .then(keys => {
        const activeContracts = keys.length;

        // Prepare the response
        const response = {
          disk: {
            total: total.toString(), // Total disk space in bytes
            free: free.toString(),   // Free disk space in bytes
            used: used.toString()    // Used disk space in bytes
          },
          ipfsRepo: {
            size: live_stats.repoSize.toString(),       // Current IPFS repo size
            numObjects: live_stats.numObjects.toString(), // Number of IPFS objects
            storageMax: live_stats.storageMax.toString()  // Max IPFS repo size
          },
          activeContracts: activeContracts // Number of active contracts
        };

        res.status(200).json(response);
      })
      .catch(err => {
        console.error('Error getting active contracts:', err);
        res.status(500).json({ message: 'Error retrieving active contracts' });
      });
  });
};

exports.promo_contract = (req, res, next) => {
  const user = req.query.user;
  console.log('promo',{ user })
  fetch(`${config.SPK_API}/@${user}`).then(rz => rz.json()).then(json => {
    if (!json.channels[config.account] && json.pubKey != 'NA') { //no contract
      var grant = parseInt(config.base_grant * 2), multiplier = 1
      const powder = parseInt(live_stats.broca.split(',')[0])
      const cap = live_stats.spk_power * config.base_grant
      if (powder / cap > 0.8) {
        multiplier = 8
      } else if (powder / cap > 0.6) {
        multiplier = 4
      } else if (powder / cap > 0.4) {
        multiplier = 2
      }
      if (live_stats.granted[user]) {
        grant = parseInt((live_stats.granted[user] / live_stats.granted.t) * multiplier * (.2 * cap))
      }
      live_stats.broca = `${powder - grant},${live_stats.broca.split(',')[1]}`
      const operations = [
        [
          'custom_json',
          {
            "required_auths": [
              config.account
            ],
            "required_posting_auths": [],
            "id": "spkccT_channel_open",
            "json": `{\"broca\":${grant},\"broker\":\"${config.account}\",\"to\":\"${user}\",\"contract\":\"0\"}`
          }
        ]
      ]
      const tx = new hiveTx.Transaction()
      tx.create(operations).then(() => {
        const privateKey = hiveTx.PrivateKey.from(config.active_key)
        tx.sign(privateKey)
        tx.broadcast().then(r => {
          console.log({ r })
          res.status(200)
            .json({
              message: 'Contract Sent',
              tx: r
            });
        })
      })
        .catch(e => {
          console.log(e)
          res.status(400)
            .json({
              message: 'File Contract Build Failed'
            });
        })
    } else {
      res.status(400)
        .json({
          message: 'Contract Exists or User PubKey Not Found'
        });
    }
  }).catch(e => {
    next(e)
  })
}

exports.contract = (req, res, next) => {
  const user = req.query.user;
  console.log('contract',{ user })
  fetch(`${config.SPK_API}/@${user}`).then(rz => rz.json()).then(json => {
    if (!json.channels[config.account] && json.pubKey != 'NA') { //no contract
      var grant = config.base_grant, multiplier = 1
      const powder = parseInt(live_stats.broca.split(',')[0])
      const cap = live_stats.spk_power * config.base_grant
      if (powder / cap > 0.8) {
        multiplier = 8
      } else if (powder / cap > 0.6) {
        multiplier = 4
      } else if (powder / cap > 0.4) {
        multiplier = 2
      }
      if (live_stats.granted[user]) {
        grant = parseInt((live_stats.granted[user] / live_stats.granted.t) * multiplier * (.2 * cap))
      }
      live_stats.broca = `${powder - grant},${live_stats.broca.split(',')[1]}`
      const operations = [
        [
          'custom_json',
          {
            "required_auths": [
              config.account
            ],
            "required_posting_auths": [],
            "id": "spkccT_channel_open",
            "json": `{\"broca\":${grant},\"broker\":\"${config.account}\",\"to\":\"${user}\",\"contract\":\"1\",\"slots\":\"dlux-io,1000\"}`
          }
        ]
      ]
      const tx = new hiveTx.Transaction()
      tx.create(operations).then(() => {
        const privateKey = hiveTx.PrivateKey.from(config.active_key)
        tx.sign(privateKey)
        tx.broadcast().then(r => {
          console.log({ r })
          res.status(200)
            .json({
              message: 'Contract Sent',
              tx: r
            });
        })
      })
        .catch(e => {
          console.log(e)
          res.status(400)
            .json({
              message: 'File Contract Build Failed'
            });
        })
    } else {
      res.status(400)
        .json({
          message: 'Contract Exists or User PubKey Not Found'
        });
    }
  }).catch(e => {
    next(e)
  })
}

exports.upload = (req, res, next) => {
  const contract = req.headers['x-contract'];
  const contentRange = req.headers['content-range'];
  const fileId = req.headers['x-cid'];
  console.log({ contract, contentRange, fileId })
  if (!contract) {
    console.log('Missing Contract');
    return res
      .status(406)
      .json({ message: 'Missing "x-contract" header' });
  }

  if (!contentRange) {
    console.log('Missing Content-Range');
    return res
      .status(405)
      .json({ message: 'Missing "Content-Range" header' });
  }

  if (!fileId) {
    console.log('Missing File Id');
    return res
      .status(404)
      .json({ message: 'Missing "x-cid" header' });
  }

  const match = contentRange
    .match(/bytes=(\d+)-(\d+)\/(\d+)/);

  if (!match) {
    console.log('Invalid Content-Range Format');
    return res
      .status(403)
      .json({ message: 'Invalid "Content-Range" Format' });
  }

  const rangeStart = Number(match[1]);
  const rangeEnd = Number(match[2]);
  const fileSize = Number(match[3]);

  if (
    rangeStart >= fileSize ||
    rangeStart >= rangeEnd ||
    rangeEnd > fileSize
  ) {
    return res
      .status(402)
      .json({ message: 'Invalid "Content-Range" provided' });
  }

  const busboy = Busboy({ headers: req.headers });

  busboy.on('file', (name, file, info) => {
    const filePath = getFilePath(fileId, contract);
    if (!fileId || !contract) {
      req.pause();
    }

    fs.stat(filePath)
      .then((stats) => {

        if (stats.size !== rangeStart) {
          return res
            .status(403)
            .json({
              message: 'Bad "chunk" provided',
              startByte: rangeStart,
              haveByte: stats.size
            });
        }

        file
          .pipe(fs.createWriteStream(filePath, { flags: 'a' }))
          .on('error', (e) => {
            console.error('failed upload', e);
            res.sendStatus(500);
          })
          .on('close', () => {
            console.log('close')
          })
      })
      .catch(err => {
        console.log('No File Match', err);
        res
          .status(401)
          .json({
            message: 'No file with such credentials'
          });
      })
  });

  busboy.on('error', (e) => {
    console.error('failed upload', e);
    res.sendStatus(501);
  })

  busboy.on('finish', () => {
    localIpfsUpload(fileId, contract).then(r => {
      console.log('finish')
      res.status(r.status).json(r.message)
    })

  });

  req.pipe(busboy);
}

exports.live = (req, res, next) => {
  console.log('live')
  const StorageMax = BigInt(live_stats.storageMax).toString()
  const RepoSize = BigInt(live_stats.repoSize).toString()
  const NumObjects = BigInt(live_stats.numObjects).toString()
  return res.status(200).json({
    ipfsid: live_stats.ipfsid,
    pubKey: live_stats.pubKey,
    head_block: live_stats.head_block,
    node: config.account,
    api: live_stats.node,
    StorageMax,
    RepoSize,
    NumObjects,
  })
}

exports.flags = (req, res, next) => {
  var flag = false
  fs.readJSON(`./db/${req.params.cid}.flag`)
    .then(json => {
      res.status(200).json({
        flag: true
      })
    })
    .catch(e => {
      res.status(200).json({
        flag: false
      })
    })
}

exports.flag = (req, res, next) => {
  const CID = req.query.cid
  const sig = req.query.sig
  const unflag = req.query.unflag || false
  const signed = verifySig(`${CID}`, sig, config.posting_pub)
  if (signed && !unflag) {
    fs.write(`./db/${CID}.flag`, 1)
      .then(json => {
        console.log('flagged', CID)
      })
      .catch(e => {
      })
  } else if (signed && unflag) {
    fs.remove(`./db/${CID}.flag`)
      .then(json => {
        console.log('unflagged', CID)
      })
      .catch(e => {
      })
  }
  res.status(200).json({
    msg: `${CID} has been ${signed ? 'flagged' : 'unflagged'}`,
  })
}

exports.contractIDs = (req, res, next) => {
  console.log('contractIDs')
  DB.getKeys('contracts')
    .then(keys => {
      res.status(200).json({
        contracts: keys
      })
    })
    .catch(e => {
      res.status(200).json({
        contracts: []
      })
    })
}

exports.contracts = (req, res, next) => {
  console.log('contracts')
  DB.getKeys('contracts')
    .then(keys => {
      // read the db and return all the contracts
      var contracts = []
      for (var i = 0; i < keys.length; i++) {
        contracts.push(DB.read(keys[i]))
      }
      Promise.all(contracts).then(contracts => {
        for (var i = 0; i < contracts.length; i++) {
          contracts[i] = JSON.parse(contracts[i])
        }
        return res.status(200).json({
          contracts
        })
      })
    })
    .catch(e => {
      res.status(200).json({
        contracts: []
      })
    })
}

exports.stats = (req, res, next) => {
  if (!req.headers || !req.headers['x-cid'] || !req.headers['x-files']
    || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract']) {
    res.status(400).json({ message: 'Missing data' });
  } else {
    let chain = req.headers['x-chain'] || 'HIVE'
    let account = req.headers['x-account'];
    let sig = req.headers['x-sig'];
    let cid = req.headers['x-cid'];
    let contract = req.headers['x-contract'];
    let cids = req.headers['x-files'];
    if (!account || !sig || !cids) {
      res.status(401).send("Access denied. No Valid Signature");
      return
    }
    getAccountPubKeys(account)
      .then((r) => {
        if (
          //true
          !r[1][0] || //no error
          'NA' != r[1][1] //or account mismatch
        ) {

          fs.stat(getFilePath(cid, contract))
            .then((stats) => {
              res.status(200)
                .json({ totalChunkUploaded: stats.size });
            })
        } else {
          res.status(400).send("Storage Mismatch: " + cid);
        }
      })
  }
}

exports.arrange = (req, res, next) => {
  // Check for required headers (x-files and x-meta are no longer expected in headers)
  if (!req.headers || !req.headers['x-cid'] || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract']) {
    return res.status(400).json({ message: 'Missing required header data' });
  }

  // Check for required body parameters (cids and meta)
  if (!req.body || typeof req.body.files === 'undefined' || typeof req.body.meta === 'undefined') {
    console.log('Missing cids or meta in request body')
    return res.status(400).json({ message: 'Missing cids or meta in request body' });
  }

  // Define variables from headers
  let chain = req.headers['x-chain'] || 'HIVE';
  let account = req.headers['x-account'];
  let sig = req.headers['x-sig'];
  let contract = req.headers['x-contract'];
  
  // Define cids and meta from body
  let cids = req.body.files;
  let meta = decodeURI(req.body.meta);
  console.log({ cids, meta })

  // Check if account or sig (from headers) are empty/invalid
  // This check was part of the original logic and should be maintained.
  if (!account || !sig) {
    return res.status(401).send("Access denied. No Valid Signature");
  }
  
  console.log(`Verifying signature for account: ${account}, contract: ${contract}`);
  // Log signature info without revealing full details
  console.log(`Signature length: ${sig ? sig.length : 0}`);
  
  var getPubKeys = getAccountPubKeys(account)
  Promise.all([getPubKeys, getContract({ to: account, from: contract.split(':')[0], id: contract.split(':')[1] })])
    .then((r) => {
      var files = cids.split(',');
      for (var i = 0; i < files.length; i++) {
        if (!files[i]) files.splice(i, 1);
      }
      const CIDs = cids.split(',');
      finish(contract)

      function finish(nonce) {
        DB.read(contract)
          .then(j => {
            try {
              j = JSON.parse(j)
              const found = j.sig == sig ? true : false
              j.s = r[1][1].a,
                j.t = 0,
                j.fo = r[1][1].t,
                j.co = r[1][1].b,
                j.f = r[1][1].f,
                j.df = files,
                j.n = cids.split(',').length - 1,
                j.u = 0,
                j.e = r[1][1].e ? r[1][1].e.split(':')[0] : '',
                j.sig = sig,
                j.key = r[0][1],
                j.b = r[1][1].r,
                j.id = r[1][1].i
              j.m = meta
              
              if (account != j.fo) { //or account mismatch
                res.status(401).send("Access denied. Contract Mismatch");
              } else {
                const sigMsg = `${account}:${contract}${cids}`;
                console.log(`Verifying signature for message: ${sigMsg.substring(0, 30)}...`);
                
                const isValid = verifySig(sigMsg, sig, r[0][1]);
                
                if (isValid) {
                  if (!found) {
                    for (var i = 1; i < CIDs.length; i++) {
                      checkThenBuild(getFilePath(CIDs[i], contract));
                    }
                    DB.write(j.id, JSON.stringify(j)).then(r => {
                      res.status(200).json({ authorized: CIDs });
                    })
                  } else res.status(200).json({ authorized: CIDs });
                } else {
                  res.status(401).send("Access denied. Signature Mismatch");
                }
              }
            } catch (error) {
              console.log('Error processing request:', error);
              res.status(500).send("Server error processing request");
            }
          })
          .catch(err => {
            console.log('Error reading contract:', err);
            res.status(500).send("Error reading contract data");
          });
      }
    })
    .catch(err => {
      console.log('Error fetching account or contract data:', err);
      res.status(500).send("Error processing contract verification");
    });
}

function checkThenBuild(path) {
  fs.stat(path).then(stats => {

  })
    .catch(err => {
      fs.createWriteStream(
        path, { flags: 'w' }
      );
    })
}

function signNupdate(contract) {
  return new Promise((resolve, reject) => {
    // Build the sizes string
    var sizes = '';
    for (var i = 0; i < contract.df.length; i++) {
      sizes += `${contract[contract.df[i]]},`;
    }
    sizes = sizes.substring(0, sizes.length - 1);

    // Construct the original data object
    const data = {
      fo: contract.fo, // file owner
      id: contract.id, // contract id
      sig: contract.sig, // signature of uploader
      co: config.account, // broker
      f: contract.f, // from
      c: contract.df.join(','), // cids uploaded
      s: sizes,
      m: contract.m
    };

    // Stringify the data and define limits
    const jsonString = JSON.stringify(data);
    const maxJsonLength = config.maxJsonLength; // Maximum characters per transaction
    const chunkSize = config.chunkSize; // Chunk size to leave room for metadata

    if (jsonString.length <= maxJsonLength) {
      // **Single Transaction Case**
      const operations = [
        [
          'custom_json',
          {
            "required_auths": [config.account],
            "required_posting_auths": [],
            "id": "spkccT_channel_update",
            "json": jsonString
          }
        ]
      ];
      const tx = new hiveTx.Transaction();
      tx.create(operations)
        .then(() => {
          const privateKey = hiveTx.PrivateKey.from(config.active_key);
          tx.sign(privateKey);
          tx.broadcast()
            .then(resolve)
            .catch(err => {
              console.log({ err });
              reject(err);
            });
        })
        .catch(err => {
          console.log({ err });
          reject(err);
        });
    } else {
      // **Chunked Transaction Case**
      const chunks = splitString(jsonString, chunkSize);
      const total_chunks = chunks.length;
      const update_id = contract.id.split(':')[2]; // Unique part of contract.id

      // Helper function to send a chunk
      const sendChunk = (chunk_id, chunk_data) => {
        const chunk_json = {
          fo: contract.fo,
          id: contract.id,
          sig: contract.sig,
          co: config.account,
          f: contract.f,
          update_id: update_id,
          chunk_id: chunk_id + 1, // Start from 1
          total_chunks: total_chunks,
          chunk_data: chunk_data
        };
        const operations = [
          [
            'custom_json',
            {
              "required_auths": [config.account],
              "required_posting_auths": [],
              "id": "spkccT_channel_update",
              "json": JSON.stringify(chunk_json)
            }
          ]
        ];
        const tx = new hiveTx.Transaction();
        return new Promise((res, rej) => {
          tx.create(operations)
            .then(() => {
              const privateKey = hiveTx.PrivateKey.from(config.active_key);
              tx.sign(privateKey);
              tx.broadcast()
                .then(res)
                .catch(err => {
                  console.log({ err });
                  rej(err);
                });
            })
            .catch(err => {
              console.log({ err });
              rej(err);
            });
        });
      };

      // Send the first chunk immediately
      sendChunk(0, chunks[0])
        .then(() => {
          // Chain the remaining chunks with a 3-second delay
          let promiseChain = Promise.resolve();
          for (let i = 1; i < chunks.length; i++) {
            promiseChain = promiseChain
              .then(() => new Promise(res => setTimeout(res, 3000))) // 3-second delay
              .then(() => sendChunk(i, chunks[i]));
          }
          return promiseChain;
        })
        .then(resolve)
        .catch(err => {
          console.log({ err });
          reject(err);
        });
    }
  });
}

// Helper function to split a string into chunks
function splitString(str, chunkSize) {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

function sign(msg, key) {
  const { sha256 } = require('hive-tx/helpers/crypto')
  const privateKey = hiveTx.PrivateKey.from(key)
  const message = sha256(msg)
  return privateKey.sign(message)
}

function verifySig(msg, sig, key) {
  try {
    const { sha256 } = require("hive-tx/helpers/crypto");
    // Ensure signature is in the correct format before processing
    if (!sig || typeof sig !== 'string') {
      console.log('Invalid signature format:', sig);
      return false;
    }
    
    const message = sha256(msg);
    const publicKey = hiveTx.PublicKey.from(key);
    const signature = hiveTx.Signature.from(sig);
    const verify = publicKey.verify(message, signature);
    return verify;
  } catch (error) {
    console.log('Signature verification error:', error.message);
    return false;
  }
}

function getAccountPubKeys(acc, chain = 'HIVE') {
  return new Promise((res, rej) => {
    if (chain == 'HIVE') {
      fetch(`${config.SPK_API}/@${acc}`)
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          var rez = re.pubKey
          res([0, rez]);
        })
        .catch((e) => {
          res([1, e]);
        });
    } else {
      res([1, 'Chain not supported']);
    }
  });
}

function getActiveContract(contract, chain = 'spk') {
  return new Promise((res, rej) => {
    if (chain == 'spk') {
      fetch(config.SPK_API + `/api/fileContract/${contract}`)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
          }
          return r.json();
        })
        .then((re) => {
          res([0, re]);
        })
        .catch((e) => {
          rej([1, e]);
        });
    } else {
      rej([1, "Not Found"]);
    }
  });
}

function getContract(contract, chain = 'spk') {
  return new Promise((res, rej) => {
    if (chain == 'spk') {
      fetch(config.SPK_API + `/api/contract/${contract.to}/${contract.from}/${contract.id}`)
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          res([0, re.proffer]);
        })
        .catch((e) => {
          res([1, e]);
        });
    } else {
      res([1, 'Chain not supported']);
    }
  });
}

function storeByContract(str) {
  const contracts = str.split(',')
  for (var i = 0; i < contracts.length; i++) {
    getActiveContract(contracts[i]).then(contract => {
      contract = contract[1].result
      DB.write(contract.i, JSON.stringify(contract))
      for (var cid in contract.df) {
        ipfs.pin.add(cid, function (err, data) {
          console.log(err, data)
          if (err) {
            console.log(err)
          }
        })
      }
    })
  }
}

function deleteByContract(str) {
  console.log("deleteByContract ", str)
  const contracts = str.split(',')
  console.log(contracts)
  for (var i = 0; i < contracts.length; i++) {
    console.log(contracts[i])
    getActiveContract(contracts[i]).then(contract => {
      contract = contract[1].result
      DB.delete(contract.i)
      for (var cid in contract.df) {
        console.log(cid)
        ipfsUnpin(cid)
      }
    })
  }
}