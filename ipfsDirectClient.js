// Direct HTTP API client for IPFS to bypass multiaddr protocol issues
const fetch = require('node-fetch');
const config = require('./config');

class IPFSDirectClient {
  constructor() {
    this.baseURL = `${config.ENDPROTOCOL || 'http'}://${config.ENDPOINT}:${config.ENDPORT}/api/v0`;
    this.connected = false;
    this.id = null;
  }

  // Test connection and get node ID
  async connect() {
    try {
      const response = await fetch(`${this.baseURL}/id`, { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      this.id = data.ID;
      this.connected = true;
      console.log('[IPFSDirectClient] Connected to IPFS node:', this.id);
      return data;
    } catch (error) {
      console.error('[IPFSDirectClient] Connection failed:', error.message);
      this.connected = false;
      throw error;
    }
  }

  // Get repository statistics
  async repoStat() {
    const response = await fetch(`${this.baseURL}/repo/stat`, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Add a file to IPFS using multipart boundary
  async add(content) {
    const boundary = '----FormDataBoundary' + Math.random().toString(36);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    
    // Build multipart form data manually
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="file"; filename="file"\r\n'),
      Buffer.from('Content-Type: application/octet-stream\r\n\r\n'),
      buffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    
    const response = await fetch(`${this.baseURL}/add?pin=false`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      cid: { toString: () => data.Hash },
      path: data.Name,
      size: data.Size
    };
  }

  // Pin a CID
  async pinAdd(cid) {
    const response = await fetch(`${this.baseURL}/pin/add?arg=${cid}`, { method: 'POST' });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pin failed: ${error}`);
    }
    return response.json();
  }

  // Unpin a CID
  async pinRm(cid) {
    const response = await fetch(`${this.baseURL}/pin/rm?arg=${cid}`, { method: 'POST' });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Unpin failed: ${error}`);
    }
    return response.json();
  }

  // List pins (generator function)
  async *pinLs(options = {}) {
    const path = options.paths && options.paths[0];
    const url = path ? `${this.baseURL}/pin/ls?arg=${path}` : `${this.baseURL}/pin/ls`;
    
    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      if (response.status === 500 && path) {
        // Path not found
        return;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    for (const [cid, info] of Object.entries(data.Keys || {})) {
      yield { cid: { toString: () => cid }, type: info.Type };
    }
  }

  // Compatibility wrapper for ipfs.id()
  async id() {
    if (!this.connected) {
      await this.connect();
    }
    return { id: this.id };
  }

  // Compatibility wrapper for ipfs.repo.stat()
  repo = {
    stat: async () => {
      const data = await this.repoStat();
      return {
        repoSize: data.RepoSize,
        storageMax: data.StorageMax,
        numObjects: data.NumObjects
      };
    }
  };

  // Compatibility wrapper for ipfs.pin
  pin = {
    add: (cid) => this.pinAdd(cid),
    rm: (cid) => this.pinRm(cid),
    ls: (options) => this.pinLs(options)
  };
}

let directClient = null;

function initializeIPFS() {
  if (directClient && directClient.connected) {
    return directClient;
  }
  
  try {
    console.log('[IPFSDirectClient] Initializing direct HTTP client...');
    directClient = new IPFSDirectClient();
    
      // Don't connect immediately, let the caller handle it
    return directClient;
  } catch (e) {
    console.error('[IPFSDirectClient] Failed to initialize:', e.message);
    return null;
  }
}

function getIPFSInstance() {
  return directClient;
}

module.exports = {
  initializeIPFS,
  getIPFSInstance
};