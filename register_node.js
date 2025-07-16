require("dotenv").config();
const ENV = process.env;
const account = ENV.ACCOUNT || '';
const active_key = ENV.ACTIVE || ''
const domain = ENV.DOMAIN || ''
const ipfsSubDomain = ENV.IPFSSUBDOMAIN || 'ipfs'
const poaSubDomain = ENV.POASUBDOMAIN || 'poa'
const fetch = require('node-fetch');
const dhive = require('@hiveio/dhive');
var registered = false, vcode = ENV.VALIDATOR != "false" ? true : false, vreg = true, balance = 0, amount = 0
var client = new dhive.Client(["https://api.hive.blog", "https://anyx.io"]);
var key = dhive.PrivateKey.fromString(active_key);
var price = 2000
const { create } = require('ipfs-http-client')
var ipfs = create({
    host: '127.0.0.1',
    port: 5001,
    protocol: 'http'
})
if(!active_key || !account){
    console.log("no key/account, Can't auto register")
    process.exit()

}
console.log('Validator:', vcode)
console.log('Account:', account)
console.log('Domain:', domain)

const RegisterService = (amount, type, api) => {
    return new Promise((resolve, reject)=>{
        ipfs.id().then(r => {
            client.broadcast.json({
                required_auths: [account],
                required_posting_auths: [],
                id: "spkccT_register_service",
                json: JSON.stringify({
                    amount,
                    type,
                    id: r.id,
                    api,
    
                })
            }, key).then(r=>{
                resolve(r)
            }).catch(e=>{
                reject(e)
            })
          }).catch(e => {
            console.error(e)
          })
    })
}
const RegisterVal = (amount) => {
    return new Promise((resolve, reject)=>{
        client.broadcast.json({
            required_auths: [account],
            required_posting_auths: [],
            id: "spkccT_validator_burn",
            json: JSON.stringify({
                amount
            })
        }, key).then(r=>{
            resolve(r)
        }).catch(e=>{
            reject(e)
        })
    })
}

const Paccount = (acc) => {
    return new Promise((resolve, reject)=>{
 fetch('https://spktest.dlux.io/@' + acc).then(r => r.json()).then(r=>{
    if(!r.pubKey)fetch("https://api.hive.blog", {
        body: JSON.stringify({
            "jsonrpc": "2.0",
            "method": "condenser_api.get_accounts",
            "params": [[account]],
            "id": 1
        }),
        headers: {
            "Content-Type": "application/json"
        },
        method: "POST"
    }).then(r => r.json()).then(r => {
        console.log(r.result[0].posting.key_auths[0][0])
        client.broadcast.json({
            required_auths: [account],
            required_posting_auths: [],
            id: "spkccT_register_authority",
            json: JSON.stringify({
                pubKey: r.result[0].posting.key_auths[0][0]
            })
        }, key)
    }).catch(e => {
        console.log(e)
    })
    resolve(r)})
    })
}
const Pstats = () => {
    return new Promise((resolve, reject)=>{
        fetch(`https://spktest.dlux.io/`).then(r => r.json()).then(r=>{resolve(r)})
    })
}
const Pval = () => {
    return new Promise((resolve, reject)=>{
        fetch(`https://spktest.dlux.io/services/VAL`).then(r => r.json()).then(r=>{resolve(r)})
    })
}
const Pipfs = () => {
    return new Promise((resolve, reject)=>{
        fetch(`https://spktest.dlux.io/services/IPFS`).then(r => r.json()).then(r=>{resolve(r)})
    })
}
const Pmarkets= () => {
    return new Promise((resolve, reject)=>{
        fetch(`https://spktest.dlux.io/markets`).then(r => r.json()).then(r=>{resolve(r)})
    })
}

Promise.all([Paccount(account), Pstats(), Pval(), Pmarkets(), ipfs.id(), Pipfs()]).then(r => {
    const price = r[1].result.IPFSRate
    console.log(r[0].storage, r[4].id)
    if(r[0].storage == r[4].id){
        console.log('storage already registered')
        registered = true
    } else {
        registered = false
    }
    if(r[2].providers?.[account] == r[4].id){
        vreg = true
    } else if (ENV.VALIDATOR != 'false' && (!r[2].providers?.[account] || r[2].providers?.[account].indexOf(r[4].id) < 0)){
        console.log('Registering VAL')
        vreg = false
    }
    if(vcode && !r[3].markets.node[account]?.val_code){
        console.log('Registering VAL')
    } else {
        console.log('VAL already registered')
        vcode = false
    }
    var fees = 0
    if(!vreg)fees++
    if(!registered)fees++
    if(vcode)fees++
    balance = r[0].balance
    amount = price * fees
    if(!fees){
        console.log('nothing to do')
        process.exit()
    }
    if(balance < amount){
        console.log('not enough Larynx balance')
        process.exit()
    }
    if(!registered){
        RegisterService(price, 'IPFS', domain ? `https://${ipfsSubDomain}.${domain}` : "NA").then(r=>{
            console.log('IPFS registered')
            if(vcode){
                RegisterService(price, 'VAL', `https://${poaSubDomain}.${domain}`).then(r=>{
                    console.log('VAL registered')
                    if(vcode)process.exit()
                    else RegisterVal(price)
                }).catch(e=>{
                    console.log(e)
                    process.exit()
                })
            } else {
                if(!vcode)process.exit()
                else RegisterVal(price). then(r=>{
                    console.log('VAL registered')
                    process.exit()
                
                })
            }
        }).catch(e=>{
            console.log(e)
            process.exit()
        })
    } else {
        if(!vreg && domain){
            RegisterService(price, 'VAL', `https://${poaSubDomain}.${domain}`).then(r=>{
                console.log('VAL registered')
                if(vcode && domain)RegisterVal(price)
                else process.exit()
            }).catch(e=>{
                console.log(e)
                process.exit()
            })
        } else {
            if(vcode && domain)RegisterVal(price)
            else process.exit()
        }
    }
})
