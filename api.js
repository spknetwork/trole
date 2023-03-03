const fetch = require("node-fetch");
const hiveTx = require("hive-tx")
const config = require('./config')
const { Pool } = require("pg");
//var crypto = require("crypto");
const fs = require('fs-extra')
const { Blob } = require("buffer");
const getFilePath = (fileCid, contract) => `./uploads/${fileCid}-${contract}`
const Ipfs = require('ipfs-api')
var ipfs = new Ipfs(`127.0.0.1`, { protocol: 'http' })
const Busboy = require('busboy');

function localIpfsUpload(cid, contract) {

  ipfs.files.add(fs.readFileSync(getFilePath(cid, contract)), function (err, file) {
    if (err) {
      console.log(err);
    }
    //check that file[0].hash == cid and pin the file if true
    if (file[0].hash == cid) {
      console.log(contract.t , file[0].size , contract.s)
      if (contract.t + file[0].size <= contract.s) { //t total s storage
        ipfs.pin.add(cid, function (err, pin) {
          if (err) {
            console.log(err);
          }
          console.log(`pinned ${cid}`)
          // sign and update contract

        })
      }
    } else {
      console.log(`mismatch between ${cid} and ${file[0].hash}`)
      //delete file
      fs.rmSync(getFilePath(cid, contract))
      //inform user that file was not uploaded
    }
  })
}



exports.upload = (req, res) => {
  const contract = req.headers['x-contract'];
  const contentRange = req.headers['content-range'];
  const fileId = req.headers['x-cid'];
console.log({contract, contentRange, fileId})
  if (!contract) {
    console.log('Missing Contract');
    return res
      .status(400)
      .json({ message: 'Missing "x-contract" header' });
  }

  if (!contentRange) {
    console.log('Missing Content-Range');
    return res
      .status(400)
      .json({ message: 'Missing "Content-Range" header' });
  }

  if (!fileId) {
    console.log('Missing File Id');
    return res
      .status(400)
      .json({ message: 'Missing "x-cid" header' });
  }

  const match = contentRange
    .match(/bytes=(\d+)-(\d+)\/(\d+)/);

  if (!match) {
    console.log('Invalid Content-Range Format');
    return res
      .status(400)
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
      .status(400)
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
          });
      })
      .catch(err => {
        console.log('No File Match', err);
        res
          .status(400)
          .json({
            message: 'No file with such credentials'
          });
      })
  });

  busboy.on('error', (e) => {
    console.error('failed upload', e);
    res.sendStatus(500);
  })

  busboy.on('finish', () => {
    localIpfsUpload(fileId, contract)
    res.sendStatus(200)
  });

  req.pipe(busboy);
}

// const pool = new Pool({
//   connectionString: config.dbcs,
// });
// for (var table in config.tables.db) {
//   pool.query(`SELECT * FROM ${table} LIMIT 1`, [], (e, r) => {
//     if (e) {
//       console.log(`Building table: ${table}`)
//       initTable(config.tables.db[table]);
//     } else {
//       console.log(`${table} already exists.`);
//       var columns = Object.keys(config.tables.db[table].table);
//       for (var i = 0; i < r.fields.length; i++) {
//         if (columns.indexOf(r.fields[i].name) >= 0) {
//           columns.splice(columns.indexOf(r.fields[i].name), 1);
//         }
//       }
//       for (var i = 0; i < columns.length; i++) {
//         pool.query(
//           `ALTER TABLE ${table} ADD ${columns[i]} ${config.tables.db[table].table[columns[i]].type
//           };`,
//           [],
//           (e, r) => {
//             if (e) console.log(e)
//             else console.log(`Added column ${columns[i]} to ${table}`)
//           }
//         );
//       }
//     }
//   });
// }

exports.stats = (req, res, next) => {
  if (!req.headers || !req.headers['x-cid'] || !req.headers['x-files']
  || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract']) {
    console.log(req.headers)
    res.status(400).json({ message: 'Missing data' });
  } else {
    let chain = req.headers['x-chain'] || 'HIVE'
    let account = req.headers['x-account'];
    let sig = req.headers['x-sig'];
    let cid = req.headers['x-cid'];
    let contract = req.headers['x-contract'];
    let cids = req.headers['x-files'];
    if (!account || !sig || !cids) {
      console.log('first out')
      res.status(401).send("Access denied. No Valid Signature");
      return
    }
    getAccountPubKeys(account)
      .then((r) => {
        if (
          true
          //!r[1][0] || //no error
          //account == r[1][1].fo //or account mismatch
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
  || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract'])  {
    console.log(req.headers)
    res.status(400).json({ message: 'Missing data' });
  } else {
    let chain = req.headers['x-chain'] || 'HIVE';
    let account = req.headers['x-account'];
    let sig = req.headers['x-sig'];
    let cids = req.headers['x-files'];
    let contract = req.headers['x-contract'];
    if (!account || !sig) {
      console.log('first out')
      res.status(401).send("Access denied. No Valid Signature");
      return
    }
    console.log({chain, account, sig, cids, contract})
    var getPubKeys = getAccountPubKeys(account)
    Promise.all([getPubKeys, getContract(req.headers.contract)])
      .then((r) => {
        console.log('verify',verifySig(`${account}:${contract}${cids}`, sig, r[0][1]))
        if (
          false
          //!r[1][0] || //no error
          //account != r[1][1].fo //or account mismatch
        ) {

          res.status(401).send("Access denied. Contract Mismatch");
        } else if (verifySig(`${account}:${contract}${cids}`, sig, r[0][1])) {
          const CIDs = cids.split(',');
          for(var i = 1; i < CIDs.length; i++){
            fs.createWriteStream(
              getFilePath(CIDs[i], contract), { flags: 'w' }
            );
          }
          console.log(`authorized: ${CIDs}`)
          res.status(200).json({ authorized: CIDs }); //bytes and time remaining
        } else {
          res.status(401).send("Access denied. Signature Mismatch");
        }
      })
  }
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

function verifySig(msg, sig, keys) {
  const { sha256 } = require("hive-tx/helpers/crypto");
  const signature = hiveTx.Signature.from(sig)
  const message = sha256(msg);
  for (var i = 0; i < keys.length; i++) {
    const publicKey = hiveTx.PublicKey.from(keys[i][0]);
    const verify = publicKey.verify(message, signature);
    if (verify) return true
  }
  return false
}

function getAccountPubKeys(acc, chain = 'HIVE') {
  return new Promise((res, rej) => {
    if (chain == 'HIVE') {
      fetch(config.HIVE_API, {
        body: `{\"jsonrpc\":\"2.0\", \"method\":\"condenser_api.get_accounts\", \"params\":[[\"${acc}\"]], \"id\":1}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      })
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          var rez = [...config.active ? re.result[0].active.key_auths : [],
          ...config.posting ? re.result[0].posting.key_auths : []]
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
      fetch(config.SPK_API + `/api/contract/${contract}`)
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          res([0, re.contract]);
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
      data.hash,
      data.size,
      data.ts,
      data.account,
      data.sig,
      data.exp,
      data.contract,
      data.pinned
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