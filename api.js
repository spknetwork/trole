const fetch = require("node-fetch");
const hiveTx = require("hive-tx")
const config = require('./config')
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: config.dbcs,
});
const fs = require('fs-extra')
const { Blob } = require("buffer");
const getFilePath = (fileCid, contract) => `./uploads/${fileCid}-${contract}`
const Ipfs = require('ipfs-api')
var ipfs = new Ipfs(`127.0.0.1`, { protocol: 'http' })
const Busboy = require('busboy');

var live_stats = {}
getStats()
var lock = {}

function getStats() {
  fetch(`${config.SPK_API}/@${config.account}`).then(rz => rz.json()).then(json => {
    live_stats = json
  })
  setTimeout(getStats, 30 * 60 * 1000)
}

const DB = {
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
        .then(json => res(json))
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

function localIpfsUpload(cid, contractID, res) {
  console.log('ipfsUpload', cid, contractID)
  DB.read(contractID)
    .then(str => {
      var contract = JSON.parse(str)
      ipfs.files.add(fs.readFileSync(getFilePath(cid, contract.id)), function (err, file) {
        if (err) {
          console.log('File add Error: ', err);
        }
        //check that file[0].hash == cid and pin the file if true
        if (str.indexOf(file[0].hash) > 0) {
          console.log(contract.t, file[0].size, contract.s)
          if (contract.t + file[0].size <= contract.s) { //t total s storage
            ipfs.pin.add(cid, function (err, pin) {
              if (err) {
                console.log(err);
                res
                  .status(410)
                  .json({
                    message: 'Internal Error'
                  });
              }
              console.log(`pinned ${cid}`)
              // sign and update contract
              DB.read(contractID)
                .then(str => {
                  contract = JSON.parse(str)
                  contract[cid] = file[0].size
                  DB.write(contract.id, JSON.stringify(contract))
                    .then(json => {
                      console.log('signNupdate', contract)
                      var allDone = true
                      for (var i = 0; i < contract.files.length; i++) {
                        console.log(contract.files[i], contract[contract.files[i]], cid, i)
                        if (!contract[contract.files[i]]) {
                          allDone = false
                          break
                        }
                      }
                      if (allDone) {
                        signNupdate(contract)
                        //delete files
                        for (var i = 0; i < contract.files; i++) {
                          fs.rmSync(getFilePath(contract.files[i], contract.id))
                        }
                        res.sendStatus(200)
                          .json({
                            contract,
                            message: 'Success'
                          });
                      }
                    })
                })
            })
          } else {
            console.log(`Files larger than contract: ${file[0].hash}`)
            fs.rmSync(getFilePath(cid, contract.id))
            DB.delete(contract.id)
            res
              .status(400)
              .json({
                contract,
                message: 'Contract Space Exceeded: Failed'
              });
          }
        } else {
          console.log(`mismatch between ${cid} and ${file[0].hash}`)
          fs.rmSync(getFilePath(cid, contract.id))
          fs.createWriteStream(
            getFilePath(cid, contract.id), { flags: 'w' }
          );
          res
            .status(400)
            .json({
              message: 'File Credential Mismatch'
            });
        }
      })
    })
}

exports.contract = (req, res) => {
  const user = req.query.user;
  fetch(`${config.SPK_API}/@${user}`).then(rz => rz.json()).then(json => {
    if (!json.channels[config.account] && json.pubKey != 'NA') { //no contract
      var grant = 1000, multiplier = 1
      const powder = parseInt(live_stats.broca.split(',')[0])
      const cap = live_stats.spk_power * 1000
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
            "id": "spkcc_channel_open",
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
  })
}

exports.upload = (req, res) => {
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
            .status(400)
            .json({ message: 'Bad "chunk" provided' });
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
    localIpfsUpload(fileId, contract)
    res.sendStatus(200);
  });

  req.pipe(busboy);
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
  if (!req.headers || !req.headers['x-cid'] || !req.headers['x-files']
    || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract']) {
    res.status(400).json({ message: 'Missing data' });
  } else {
    let chain = req.headers['x-chain'] || 'HIVE';
    let account = req.headers['x-account'];
    let sig = req.headers['x-sig'];
    let cids = req.headers['x-files'];
    let contract = req.headers['x-contract'];
    if (!account || !sig) {
      res.status(401).send("Access denied. No Valid Signature");
      return
    }
    var getPubKeys = getAccountPubKeys(account)
    Promise.all([getPubKeys, getContract({ to: account, from: contract.split(':')[0], id: contract.split(':')[1] })])
      .then((r) => {
        var files = cids.split(',');
        for (var i = 0; i < files.length; i++) {
          if (!files[i]) files.splice(i, 1);
        }
        DB.read(contract)
          .then(j => {
            j = JSON.parse(j)
            j.s = r[1][1].a,
            j.t = 0,
            j.fo = r[1][1].t,
            j.co = r[1][1].b,
            j.f = r[1][1].f,
            j.files = files,
            j.n = cids.split(',').length - 1,
            j.u = 0,
            j.e = r[1][1].e.split(':')[0],
            j.sig = sig,
            j.key = r[0][1],
            j.b = r[1][1].r,
            j.id = r[1][1].i
            if (
              account != j.fo //or account mismatch
            ) {
              res.status(401).send("Access denied. Contract Mismatch");
            } else if (verifySig(`${account}:${contract}${cids}`, sig, r[0][1])) {
              const CIDs = cids.split(',');
              for (var i = 1; i < CIDs.length; i++) {
                checkThenBuild( getFilePath(CIDs[i], contract) );
              }
              DB.write(j.id, JSON.stringify(j))
              console.log(`authorized: ${CIDs}`)
              res.status(200).json({ authorized: CIDs }); //bytes and time remaining
            } else {
              res.status(401).send("Access denied. Signature Mismatch");
            }
          })
      })
  }
}

function checkThenBuild(path){
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
    var sizes = ''
    for (var i = 0; i < contract.files.length; i++) {
      sizes += `${contract[contract.files[i]]},`
    }
    sizes = sizes.substring(0, sizes.length - 1)
    const data = {
      fo: contract.fo, //file owner
      id: contract.id, //contract id
      sig: contract.sig, //signature of uploader
      co: config.account, //broker
      f: contract.f, //from
      c: contract.files.join(','), //cids uploaded
      s: sizes
    }
    const operations = [
      [
        'custom_json',
        {
          "required_auths": [
            config.account
          ],
          "required_posting_auths": [],
          "id": "spkcc_channel_update",
          "json": JSON.stringify(data)
        }
      ]
    ]
    const tx = new hiveTx.Transaction()
    tx.create(operations).then(() => {
      const privateKey = hiveTx.PrivateKey.from(config.active_key)
      tx.sign(privateKey)
      tx.broadcast().then(r => {
      })
        .catch(e => {
          console.log({ e })
        })
    })
  })
}

exports.petition = (req, res, next) => {
  // determine if the requesting account has a high enough reputation to upload
  // if so, return the number of bytes they can upload

}

// exports.proxy = (req, res) => {
//   console.log('Somebody wants me.')
//   if (req.url.split("?")[0] == "/api/v0/add") {
//     console.log("authed and proxied");
//     proxy.web(req, res);
//   } else if (req.url.split("?")[0] == "/upload-authorize") {
//     if (!req.headers || !req.headers.cid 
//       || ! req.headers.account|| ! req.headers.sig || !req.headers.contract) {
//       res.status(400).json({message: 'Missing data'});
//    } else {
//     let chain = req.headers.chain;
//     let account = req.headers.account;
//     let sig = req.headers.sig;
//     let cid = req.headers.cid;
//     let contract = req.headers.contract;
//     if (!account || !sig) {
//       console.log('first out')
//       res.status(401).send("Access denied. No Valid Signature");
//       return
//     }
//     var getPubKeys = getAccountPubKeys(account)
//     Promise.all([getPubKeys, getContract(req.headers.contract)])
//       .then((r) => {
//         if (
//           false
//           //!r[1][0] || //no error
//           //account != r[1][1].fo //or account mismatch
//           ) {

//           res.status(401).send("Access denied. Contract Mismatch");
//         } else if (verifySig(account, sig, r[0][1], cid)) {
//           fs.createWriteStream(
//             getFilePath(req.headers.cid, req.headers.contract), {flags: 'w'}
//           );
//           res.status(200).json({authorized: req.headers.cid}); //bytes and time remaining
//         } else {
//           res.status(401).send("Access denied. Signature Mismatch");
//         }
//       })
//    }
//   } else if (req.url.split("?")[0] == "/upload-cancel") {
//     if (!req.headers || !req.headers.cid 
//       || ! req.headers.account|| ! req.headers.sig || !req.headers.contract) {
//       res.status(400).json({message: 'Missing data'});
//    } else {
//     let chain = req.headers.chain;
//     let account = req.headers.account;
//     let sig = req.headers.sig;
//     let cid = req.headers.cid;
//     let contract = req.headers.contract;
//     if (!account || !sig) {
//       console.log('first out')
//       res.status(401).send("Access denied. No Valid Signature");
//       return
//     }
//     var getPubKeys = getAccountPubKeys(account)
//     Promise.all([getPubKeys, getContract(req.headers.contract)])
//       .then((r) => {
//         if (
//           false
//           //!r[1][0] || //no error
//           //account != r[1][1].fo //or account mismatch
//           ) {
//           res.status(401).send("Access denied. Contract Mismatch");
//         } else if (verifySig(account, sig, r[0][1], cid)) {
//           fs.createWriteStream(
//             getFilePath(req.headers.cid, req.headers.contract), {flags: 'w'}
//           );
//           res.status(200).json({fileId: req.headers.cid});
//         } else {
//           res.status(401).send("Access denied. Signature Mismatch");
//         }
//       })
//    }
//   } else if (req.url.split("?")[0] == "/upload-check") {
//     if (!req.headers || !req.headers.cid 
//       || ! req.headers.account|| ! req.headers.sig || !req.headers.contract) {
//       res.status(400).json({message: 'Missing data'});
//    } else {
//     let chain = req.headers.chain;
//     let account = req.headers.account;
//     let sig = req.headers.sig;
//     let cid = req.headers.cid;
//     let contract = req.headers.contract;
//     if (!account || !sig) {
//       console.log('first out')
//       res.status(401).send("Access denied. Signature Mismatch");
//       return
//     }
//     getAccountPubKeys(account)
//       .then((r) => {
//         if (
//           true
//           //!r[1][0] || //no error
//           //account == r[1][1].fo //or account mismatch
//           ) {

//           fs.stat( getFilePath(cid, contract) )
//           .then( (stats) => {
//             res.status(200)
//                .json({totalChunkUploaded: stats.size});
//           })
//         } else {
//           res.status(400).send("Storage Mismatch: " + cid);
//         }
//       })
//    }
//   } else if (req.url.split("?")[0] == "/api/auth") {
//     res.setHeader("Content-Type", "application/json");
//     res.send(
//       JSON.stringify(
//         {
//           hive_account: config.account,
//         },
//         null,
//         3
//       )
//     );
//     console.log("huh?");
//   } else {
//     console.log('else')
//     res.sendStatus(200);
//   }
// };

// proxy.on("proxyReq", function (proxyReq, req, res, options) {
//   var hash = crypto.createHash("md5"), i = 0
//   hash.setEncoding("hex");
//   proxyReq.on("data", function(chunk){
//     console.log(i, chunk)
//     i++
//     hash.update(chunk)
//   });
//   proxyReq.on('end', function(){
//     hash.end()
//     console.log('end',hash.read())
//   });
// });

// function buildHash(rawBody, account, expectedHash = 'nothing'){
//   return new Promise((r,e)=>{
//     var hash = crypto.createHash("md5");
//     hash.setEncoding("hex");
//     console.log({ rawBody, account, expectedHash });
//   })
// }

// proxy.on("proxyRes", function (proxyRes, req, res, a) {
//   proxyRes.on("data", function (chunk) {
//     var json 

//     try{ json = JSON.parse(chunk); } catch (e) {console.log(e)}
//     try{ console.log(chunk.toString()) } catch (e) {console.log(e)}
//     //get sig and cid as well... use it to build a futures contract for payment
//     if (json && json.Size){
//       const data = [
//         json.Hash,
//         parseInt(json.Size),
//         req.headers.cid,
//         req.headers.account,
//         req.headers.sig,
//         Date.now() + 86400000,
//         "",
//         true,
//         0,
//         0,
//       ];

//       console.log(data)
//       //updatePins(data)
//     }
//   });
// });


// exports.auth = (req, res, next) => {
//   console.log('Authing')
//   let chain = req.headers.chain;
//   let account = req.headers.account;
//   let sig = req.headers.sig;
//   let cid = req.headers.cid;
//   if (!account || !sig) {
//     console.log('first out')
//     res.status(401).send("Access denied. Signature Mismatch");
//     return
//   }
//   getAccountPubKeys(account)
//     .then((r) => {
//       if (r[0]) {
//         console.log('second out')
//         res.status(401).send(`Access denied. ${r[1]}`);
//         return
//       }
//       const challenge = verifySig(account, sig, r[1], cid);
//       if (!challenge){
//         console.log('third out')
//         res.status(401).send("Access denied. Invalid Signature");
//         return
//       } else next();
//     })
//     .catch((e) => {
//       console.log('Error out')
//       res.status(401).send(`Access denied. ERROR: ${e}`);
//     });
// };

function sign(msg, key) {
  const { sha256 } = require('hive-tx/helpers/crypto')
  const privateKey = hiveTx.PrivateKey.from(key)
  const message = sha256(msg)
  return privateKey.sign(message)
}

function verifySig(msg, sig, key) {
  const { sha256 } = require("hive-tx/helpers/crypto");
  const signature = hiveTx.Signature.from(sig)
  const message = sha256(msg);
  const publicKey = hiveTx.PublicKey.from(key);
  const verify = publicKey.verify(message, signature);
  if (verify) return true
  return false
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


/*
[
      cids VARCHAR UNIQUE,
        size INT ,
        ts BIGINT ,
        account VARCHAR ,
        sponsor VARCHAR ,
        validator VARCHAR ,
        fosig VARCHAR ,
        spsig VARCHAR ,
        exp BIGINT ,
        broca INT ,
        contract VARCHAR ,
        pinned INT ,
        flag INT ,
        state  INT
    ]
*/

function updatePins(data) {
  return new Promise((r, e) => {
    pool.query(
      `INSERT INTO pins(hash,size,ts,account,sig,exp,contract,pinned,flag,state)VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      data,
      (err, res) => {
        if (err) {
          //console.log(data)
          console.log(`Error - Failed to insert data into pins`);
          e(err);
        } else {
          r(res);
        }
      }
    );
  })
}

function initTable(struct) {
  return new Promise((r, e) => {
    var data = []
    var string = '', primary = ''
    for (var column in struct.table) {
      string += `${column} ${struct.table[column].type}, `;
      if (struct.table[column].key) primary += `${column} `
    }
    pool.query(
      `CREATE TABLE ${struct.name}(
          ${string}
        PRIMARY KEY( ${primary} )
      );`,
      data,
      (err, res) => {
        if (err) {
          console.log(`Error - Failed to insert data into pins`);
          e(err);
        } else {
          r(res);
        }
      }
    );
  })
}

// var HiveMirror = require('hive-tx')
// HiveMirror.config.node = "https://api.fake.openhive.network";
// HiveMirror.config.chain_id =
//   "42";
// HiveMirror.config.address_prefix = "STM";
// HiveMirror.call("condenser_api.get_accounts", [["mahdiyari"]]).then((res) =>
//   console.log(res)
// );