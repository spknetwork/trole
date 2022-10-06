const fetch = require("node-fetch");
const hiveTx = require("hive-tx")
const config = require('./config')
const httpProxy = require("http-proxy");
const proxy = httpProxy.createProxyServer({});

exports.proxy = (req, res) => {
  let account = req.headers.account || req.query.account;
  const target = config.ENDPOINT
  console.log(`@${account} validation success. Proxying request to ${target}`);

  proxy.web(req, res, { target }, (error) => {
    console.error(error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        Error: error.message,
      })
    );
  });
};

exports.auth = (req, res, next) => {
let chain = req.headers.chain
  let account = req.headers.account || req.query.account;
  let sig = req.headers.sig || req.query.sig;
  let nonce = req.headers.nonce || req.query.nonce;
  if (nonce < Date.now() - 604800000 || nonce > Date.now() + 3600000)return res.status(401).send("Access denied. Signature Expired");
    if (!account || !sig) return res.status(401).send("Access denied. Signature Mismatch");
  getAccount(account, chain)
    .then((r) => {
    if(r[0])return res.status(401).send(`Access denied. ${r[1]}`);
      const challenge = verifySig(account, sig, r[1], nonce);
      if (!challenge) return res.status(401).send("Access denied. Invalid Signature");
      else next();
    })
    .catch((e) => {
      res.status(401).send(`Access denied. ${e}`);
    });
};

function sign (msg, key){
    const { sha256 } = require( 'hive-tx/helpers/crypto' )
    const privateKey = hiveTx.PrivateKey.from(key)
    const message = sha256(msg)
    return privateKey.sign(message)
}

function verifySig(msg, sig, keys, nonce){
    const { sha256 } = require("hive-tx/helpers/crypto");
    const signature = hiveTx.Signature.from(sig)
    const message = sha256(`${msg}:${nonce}`);
    for (var i = 0; i < keys.length;i++){
        const publicKey = hiveTx.PublicKey.from(keys[i][0]);
        const verify = publicKey.verify(message, signature);
        if(verify)return true
    }
    return false
}

function getAccount(acc, chain = 'HIVE') {
  return new Promise((res, rej) => {
    if(chain == 'HIVE'){
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
                 ... config.posting ? re.result[0].posting.key_auths : []]
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
