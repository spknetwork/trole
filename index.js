const config = require("./config");
const express = require("express");
const cors = require("cors");
const api = express();
var http = require("http").Server(api);
const API = require("./api");
const { ipfsProxyRoute, ipfsHealthRoute, ipfsStatsRoute, ipfsHealthPinRoute } = require("./cdn");

api.use(express.json())
api.use(cors())
api.post("/upload", API.upload)
api.get('/upload-contract', API.contract)
api.get("/upload-check", API.stats)
api.post("/upload-authorize", API.arrange)
api.get("/upload-stats", API.live)
api.get("/upload-queue", API.queueStatus)
api.get("/storage-stats", API.storageStats);
api.get("/flag-qry/:cid", API.flags)
api.get("/flag", API.flag)
api.get("/contracts", API.contracts)
api.get("/ipfs/:cid", ipfsProxyRoute)
api.get("/ipfs-health", ipfsHealthRoute)
api.get("/ipfs-stats", ipfsStatsRoute)
api.post("/ipfs-health-pin", ipfsHealthPinRoute)
if (config.promo_contract) api.get("/upload-promo-contract", API.promo_contract)
api.use(express.static("www"));

http.listen(config.port, '::', function () {
  console.log(`API listening on port ${config.port}`);
  console.log('promo:', config.promo_contract)
});

