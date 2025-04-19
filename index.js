const config = require("./config");
const express = require("express");
const cors = require("cors");
const api = express();
var http = require("http").Server(api);
const API = require("./api");

api.use(express.json())
api.use(cors())
api.post("/upload", API.upload)
api.get('/upload-contract', API.contract)
api.get("/upload-check", API.stats)
api.get("/upload-authorize", API.arrange)
api.get("/upload-stats", API.live)
api.get("/storage-stats", API.storageStats);
api.get("/flag-qry/:cid", API.flags)
api.get("/flag", API.flag)
api.get("/contracts", API.contracts)
if (config.promo_contract) api.get("/upload-promo-contract", API.promo_contract)
api.use(express.static("www"));

http.listen(config.port, '::', function () {
  console.log(`API listening on port ${config.port}`);
  console.log('promo:', config.promo_contract)
});

