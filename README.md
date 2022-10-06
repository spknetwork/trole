# Trole

Trole is a reverse proxy that verifies a structed message is signed by a valid Hive `posting` of `active` key before bridging to a service. Initially used for IPFS uploads to log where content comes from and to utilize a blacklist if necessary.

Trole uses no secrets. It verifies a valid message was signed, this message is `account_name:timecode` the account name is used to query a Hive API to find the public keys to verify the signature, while the timecode expires old signatures. 

## Setup

Place between your IPFS gateway and the internet.

### Simple

Clone Repo:

`git clone https://github.com/disregardfiat/trole`

Change Directory `cd trole`
Install Dependancies `npm i`
Configure environment

#### Sample `.env`

```
PORT=5050
posting=true
active=true
ENDPOINT="http://127.0.0.1:5001"
HIVE_API="https://anyx.io"
```

Default values shown

#### Sample nginx config

```
server {
    listen       80;
    listen  [::]:80;
    server_name  ipfs.dlux.io;
    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }
    location /api {
        proxy_http_version 1.1;
        proxy_pass   http://localhost:5050/api;
        proxy_set_header Host               $http_host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        add_header Cache-Control no-cache;
    }

    location / {
        proxy_http_version 1.1;
        proxy_pass   http://localhost:8080;
        proxy_set_header Host               $http_host;
        proxy_set_header X-Real-IP          $remote_addr;
        proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
        add_header Cache-Control no-cache;
    }
}
```
Run with `pm2`

###

Client Side append the following headers

* `account`:`valid-hive-account`
* `nonce`: `Date.now()`
* `sig`:`0123456789abcdef...`
* `chain`: `HIVE` //default value

#### With HiveKeychain
`window.hive_keychain.requestSignBuffer("disregardfiat","disregardfiat:1000","posting",sig=>{console.log(sig)})`

#### With Key
Client side signing:
`https://www.npmjs.com/package/hive-tx`
```
const hiveTx = require("hive-tx") || 
<script src="https://cdn.jsdelivr.net/npm/hive-tx/dist/hive-tx.min.js"></script>

const sig = sign(`${account}:${nonce}`, key)

function sign (msg, key){
    const { sha256 } = require( 'hive-tx/helpers/crypto' )
    const privateKey = hiveTx.PrivateKey.from(key)
    const message = sha256(msg)
    return privateKey.sign(message)
}
```
