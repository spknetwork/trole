// Centralized IPFS client module to avoid circular dependencies
const config = require('./config');

let ipfs = null;
let create = null;

function initializeIPFS() {
  if (ipfs) return ipfs; // Already initialized
  
  try {
    // Lazy load ipfs-http-client to avoid segfault on startup
    if (!create) {
      console.log('[ipfsClient] Loading ipfs-http-client module...');
      const { create: createClient } = require('ipfs-http-client');
      create = createClient;
    }
    
    console.log(`[ipfsClient] Attempting to initialize IPFS client: ${config.ENDPROTOCOL}://${config.ENDPOINT}:${config.ENDPORT}`);
    
    // New API for ipfs-http-client
    ipfs = create({
      host: config.ENDPOINT,
      port: config.ENDPORT,
      protocol: config.ENDPROTOCOL || 'http'
    });
    
    console.log('[ipfsClient] IPFS client initialized successfully');
    return ipfs;
  } catch (e) {
    console.error('[ipfsClient] Failed to initialize IPFS client:', e.message);
    console.error('[ipfsClient] IPFS operations will fail until properly configured');
    return null;
  }
}

function getIPFSInstance() {
  return ipfs;
}

module.exports = {
  initializeIPFS,
  getIPFSInstance
};