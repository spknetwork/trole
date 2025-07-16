const config = require("./config");
const express = require("express");
const cors = require("cors");
const api = express();
var http = require("http").Server(api);
const API = require("./api");
const { ipfsProxyRoute, ipfsHealthRoute, ipfsStatsRoute, ipfsHealthPinRoute, nodeHealthRoute, peerHealthStatsRoute, nodeRegionRoute } = require("./cdn");

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
api.get("/node-health/:targetNode", nodeHealthRoute)
api.get("/peer-health-stats", peerHealthStatsRoute)
api.get("/node-region", nodeRegionRoute)
if (config.promo_contract) api.get("/upload-promo-contract", API.promo_contract)
api.use(express.static("www"));

// Create separate server for health endpoint if different IP specified
if (config.HEALTH_ENDPOINT_IP && config.HEALTH_ENDPOINT_IP !== '0.0.0.0' && config.HEALTH_ENDPOINT_IP !== '::') {
  const healthApp = express();
  const healthHttp = require("http").Server(healthApp);
  
  healthApp.use(express.json());
  healthApp.use(cors());
  healthApp.get("/node-health/:targetNode", nodeHealthRoute);
  healthApp.get("/peer-health-stats", peerHealthStatsRoute);
  healthApp.get("/node-region", nodeRegionRoute);
  
  healthHttp.listen(config.port + 1, config.HEALTH_ENDPOINT_IP, function () {
    console.log(`Health API listening on ${config.HEALTH_ENDPOINT_IP}:${config.port + 1}`);
  });
}

http.listen(config.port, function () {
  console.log(`API listening on port ${config.port}`);
  console.log('promo:', config.promo_contract);
  console.log('node region:', config.NODE_REGION);
  
  // Start the maintenance function with error handling
  try {
    // Delay to ensure all modules are loaded
    setTimeout(() => {
      console.log('Starting maintenance function getStats()...');
      try {
        API.getStats();
      } catch (e) {
        console.error('Failed to start getStats:', e.message);
        // Try again in 30 seconds
        setTimeout(() => API.getStats(), 30000);
      }
    }, 10000);
  } catch (e) {
    console.error('Failed to schedule getStats:', e);
  }
});

