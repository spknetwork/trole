const fetch = require("node-fetch");
const hiveTx = require("hive-tx")
const config = require('./config')
const httpProxy = require("http-proxy");
const proxy = httpProxy.createProxyServer({});
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: config.dbcs,
});
for (var table in config.tables.db) {
  pool.query(`SELECT * FROM ${table} LIMIT 1`, [], (e, r) => {
    if (e) {
      console.log(`Building table: ${table}`)
      initTable(config.tables.db[table]);
    } else {
      console.log(`${table} already exists.`);
      var columns = Object.keys(config.tables.db[table].table);
      for (var i = 0; i < r.fields.length; i++) {
        if (columns.indexOf(r.fields[i].name) >= 0) {
          columns.splice(columns.indexOf(r.fields[i].name), 1);
        }
      }
      for (var i = 0; i < columns.length; i++) {
        pool.query(
          `ALTER TABLE ${table} ADD ${columns[i]} ${config.tables.db[table].table[columns[i]].type
          };`,
          [],
          (e, r) => {
            if (e) console.log(e)
            else console.log(`Added column ${columns[i]} to ${table}`)
          }
        );
      }
    }
  });
}

exports.proxy = (req, res) => {
  const target = config.ENDPOINT + ':' + config.ENDPORT
  if (req.url.split("?")[0] == "/api/v0/add") {
    req.url = 'api/v0/add?stream-channels=true&pin=true&wrap-with-directory=true&progress=true'
    req.query = {
      "stream-channels": "true",
      pin: "true",
      "wrap-with-directory": "true",
      progress: "true",
    };
    proxy.web(req, res, { target }, (error, r, e, t) => {
      if (error) console.log("Error: ", error);
    });
  } else res.sendStatus(403);

};

proxy.on("proxyRes", function (proxyRes, req, res, a) {
  proxyRes.on("data", function (chunk) {
    const json = JSON.parse(chunk);
    //get sig and nonce as well... use it to build a futures contract for payment
    if (json.Size)
      console.log(
        "Account: " +
        req.headers.account +
        " hash: " +
        json.Hash +
        " size: " +
        json.Size,
        req.headers.account
      );
    data = [
      json.Hash,
      parseInt(json.Size),
      req.headers.nonce,
      req.headers.account,
      req.headers.sig,
      Date.now() + 86400000,
      "",
      true,
      0,
      0
    ];
    updatePins(data)
  });
});


exports.auth = (req, res, next) => {
  let chain = req.headers.chain
  let account = req.headers.account || req.query.account;
  let sig = req.headers.sig || req.query.sig;
  let nonce = req.headers.nonce || req.query.nonce;
  if (nonce < Date.now() - 604800000 || nonce > Date.now() + 3600000) return res.status(401).send("Access denied. Signature Expired");
  if (!account || !sig) return res.status(401).send("Access denied. Signature Mismatch");
  getAccount(account, chain)
    .then((r) => {
      if (r[0]) return res.status(401).send(`Access denied. ${r[1]}`);
      const challenge = verifySig(account, sig, r[1], nonce);
      if (!challenge) return res.status(401).send("Access denied. Invalid Signature");
      else next();
    })
    .catch((e) => {
      res.status(401).send(`Access denied. ${e}`);
    });
};

function sign(msg, key) {
  const { sha256 } = require('hive-tx/helpers/crypto')
  const privateKey = hiveTx.PrivateKey.from(key)
  const message = sha256(msg)
  return privateKey.sign(message)
}

function verifySig(msg, sig, keys, nonce) {
  const { sha256 } = require("hive-tx/helpers/crypto");
  const signature = hiveTx.Signature.from(sig)
  const message = sha256(`${msg}:${nonce}`);
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