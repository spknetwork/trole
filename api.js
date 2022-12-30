const fetch = require("node-fetch");
const hiveTx = require("hive-tx")
const config = require('./config')
const httpProxy = require("http-proxy");
const proxy = httpProxy.createProxyServer({ 
  target: config.ENDPOINT + ':' + config.ENDPORT,
  changeOrigin: true,
  onProxyReq: function(request) {
    request.setHeader("origin", "");
  },
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': true,
    'Access-Control-Expose-Headers': 'X-Ipfs-Hash',
    'Connection': 'keep-alive'
  }
});
const { Pool } = require("pg");
var crypto = require("crypto");

proxy.on('proxyReq', (proxyReq, req, res, options) => {
  console.log({proxyReq, req})
});

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

exports.proxy = (req, res) => {
  console.log('Somebody wants me.')
  if (req.url.split("?")[0] == "/api/v0/add") {
    console.log("authed and proxied");
    proxy.web(req, res);
  } else if (req.url.split("?")[0] == "/api/auth") {
    res.setHeader("Content-Type", "application/json");
    res.send(
      JSON.stringify(
        {
          hive_account: config.account,
        },
        null,
        3
      )
    );
    console.log("huh?");
  } else {
    console.log('else')
    res.sendStatus(403);
  }

};

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

proxy.on("proxyRes", function (proxyRes, req, res, a) {
  proxyRes.on("data", function (chunk) {
    var json 
    
    try{ json = JSON.parse(chunk); } catch (e) {console.log(e)}
    try{ console.log(chunk.toString()) } catch (e) {console.log(e)}
    //get sig and cid as well... use it to build a futures contract for payment
    if (json && json.Size){
      const data = [
        json.Hash,
        parseInt(json.Size),
        req.query.cid,
        req.query.account,
        req.query.sig,
        Date.now() + 86400000,
        "",
        true,
        0,
        0,
      ];

      console.log(data)
      //updatePins(data)
    }
  });
});


exports.auth = (req, res, next) => {
  console.log('Authing')
  let chain = req.query.chain;
  let account = req.query.account;
  let sig = req.query.sig;
  let cid = req.query.cid;
  if (!account || !sig) {
    console.log('first out')
    res.status(401).send("Access denied. Signature Mismatch");
    return
  }
  getAccount(account, chain)
    .then((r) => {
      if (r[0]) {
        console.log('second out')
        res.status(401).send(`Access denied. ${r[1]}`);
        return
      }
      const challenge = verifySig(account, sig, r[1], cid);
      if (!challenge){
        console.log('third out')
        res.status(401).send("Access denied. Invalid Signature");
        return
      } else next();
    })
    .catch((e) => {
      console.log('Error out')
      res.status(401).send(`Access denied. ${e}`);
    });
};

function sign(msg, key) {
  const { sha256 } = require('hive-tx/helpers/crypto')
  const privateKey = hiveTx.PrivateKey.from(key)
  const message = sha256(msg)
  return privateKey.sign(message)
}

function verifySig(msg, sig, keys, cid) {
  const { sha256 } = require("hive-tx/helpers/crypto");
  const signature = hiveTx.Signature.from(sig)
  const message = sha256(`${msg}:${cid}`);
  for (var i = 0; i < keys.length; i++) {
    const publicKey = hiveTx.PublicKey.from(keys[i][0]);
    const verify = publicKey.verify(message, signature);
    if (verify) return true
  }
  return false
}

function getAccount(acc, chain = 'HIVE') {
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
          //   console.log(re.result[0].active.key_auths);
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