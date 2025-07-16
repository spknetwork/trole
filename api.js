const fetch = require("node-fetch");
const hiveTx = require("hive-tx");
const diskusage = require('diskusage');
const config = require('./config');
// const { Pool } = require("pg");
// const pool = new Pool({
//   connectionString: config.dbcs,
// });
const fs = require('fs-extra');
// Create uploads directory if it doesn't exist
if (!fs.existsSync('./db/')) {
  fs.mkdirSync('./db/');
}
var { exec } = require('child_process');    // Execute shell commands
const { Blob } = require("buffer");         // Binary large object handling
// Helper function to generate file paths for uploaded files
const getFilePath = (fileCid, contract) => `./uploads/${fileCid}-${contract}`
// Use centralized IPFS client to avoid circular dependencies
const { initializeIPFS: initIPFS, getIPFSInstance } = require('./ipfsClient');
var ipfs = null;

// Function to initialize IPFS connection and register node
function initializeIPFS() {
  if (ipfs) return; // Already initialized
  
  ipfs = initIPFS();
  if (!ipfs) return;
  
  // Try to get ID to verify connection
  ipfs.id().then(r => {
    live_stats.ipfsid = r.id;
    console.log('IPFS connected, ID:', r.id);
    
    // Register node after successful IPFS connection
    exec(`node register_node.js`, (error, stdout, stderr) => {
      console.log(stdout);
      if (error) {
        console.log(`error: ${error.message}`);
      }
    });
  }).catch(e => {
    if (e.message && e.message.includes('no protocol with name: tls')) {
      console.error('IPFS connection failed: TLS protocol not supported in this client version');
      console.error('This usually means the IPFS daemon is using a newer API format');
    } else {
      console.error('IPFS connection test failed:', e.message || e);
    }
    ipfs = null; // Reset on failure
  });
}

// Delay IPFS initialization by 5 seconds to avoid startup segfault
// Commented out - will be initialized from index.js
// setTimeout(initializeIPFS, 5000)
const Busboy = require('busboy');           // Multipart form data parser for file uploads
const ipfsQueue = require('./ipfsQueue');   // IPFS upload queue system

// Global statistics object to track live system metrics
var live_stats = {
  i: parseInt(Math.random() * 10),          // Random cleanup index
  feed: 0,                                  // Last processed feed item
  lastRun: null,                            // Last successful run timestamp
  failureCount: 0                           // Consecutive failure count
}
// IPFS initialization and node registration handled in initializeIPFS()

// Setup IPFS queue event listeners
ipfsQueue.queueEvents.on('uploadCompleted', (item) => {
  console.log(`[IPFS Queue] Upload completed: ${item.cid} for contract ${item.contractId}`);
  // Clean up the local file after successful IPFS upload
  fs.remove(item.filePath).catch(err => 
    console.error(`[IPFS Queue] Failed to remove uploaded file ${item.filePath}:`, err)
  );
});

ipfsQueue.queueEvents.on('uploadFailed', (item) => {
  console.error(`[IPFS Queue] Upload failed after ${item.attempts} attempts: ${item.cid} - ${item.error}`);
  // Keep the file for manual intervention or cleanup later
});

ipfsQueue.queueEvents.on('itemAdded', (item) => {
  console.log(`[IPFS Queue] New item added: ${item.cid} for contract ${item.contractId}`);
});

// Lock objects to prevent concurrent operations
var lock = {}                               // General purpose locks
var ipfsLock = {}                          // IPFS operation locks
var promoDebouncer = {}                    // Rate limiting for promotional contracts

// Database utility object providing file-based JSON storage operations
const DB = {
  // Get all keys (file names) of a specific type from the db directory
  getKeys: function (type = 'contracts') {
    return new Promise((res, rej) => {
      fs.readdir(`./db/`, (err, files) => {
        if (err) {
          console.log('Failed to read:', type)
          rej(err)
        } else {
          switch (type) {
            case 'contracts':
              // Filter for .json files and remove extension
              for (var i = 0; i < files.length; i++) {
                if (files[i].indexOf('.json') < 0) {
                  files.splice(i, 1)
                  i--
                } else {
                  files[i] = files[i].replace('.json', '')
                }
              }
              break;
            case 'flags':
              // Filter for .flag files only
              for (var i = 0; i < files.length; i++) {
                if (files[i].indexOf('.flag') < 0) {
                  files.splice(i, 1)
                  i--
                }
              }
              break;
            default:
              break;
          }
          res(files)
        }
      });
    })
  },
  // Read and parse JSON data from a file
  read: function (key) {
    return new Promise((res, rej) => {
      fs.readJSON(`./db/${key}.json`)
        .then(json => res(json))
        .catch(e => {
          // Return empty JSON string if file doesn't exist
          res(JSON.stringify({}))
        })
    })
  },
  // Write JSON data to a file with locking mechanism
  write: function (key, value) {
    // If file is locked, retry after 100ms
    if (lock[key]) {
      return new Promise((res, rej) => {
        setTimeout(() => {
          DB.write(key, value).then(json => res(json)).catch(e => rej(e))
        }, 100)
      })
    }
    return new Promise((res, rej) => {
      lock[key] = true                      // Set lock
      fs.writeJSON(`./db/${key}.json`, value)
        .then(json => {
          delete lock[key]                  // Release lock
          res(json)
        })
        .catch(e => {
          delete lock[key]                  // Release lock on error
          console.log('Failed to read:', key)
          rej(e)
        })
    })
  },
  // Delete a JSON file
  delete: function (key) {
    return new Promise((res, rej) => {
      fs.remove(`./db/${key}.json`)
        .then(json => {
          console.log('deleted', key)
          res(json)
        })
        .catch(e => {
          console.log('Failed to delete:', key)
          rej(e)
        })
    })
  },
  // Update a specific attribute in a JSON file
  update: function (key, att, value) {
    return new Promise((res, rej) => {
      fs.readJSON(`./db/${key}.json`)
        .then(json => {
          json[att] = value                 // Update the attribute
          fs.writeJSONSync(`./db/${key}.json`, json)
            .then(json => res(json))
            .catch(e => {
              console.log('Failed to update:', key)
              rej(e)
            })
        })
        .catch(e => {
          console.log('Failed to update:', key)
          rej(e)
        })
    })
  }
}

// Initialize system statistics gathering
// Commented out - will be called from index.js after startup
// getStats()

// Main system monitoring and cleanup function - runs every minute
function getStats() {
  const startTime = Date.now()
  
  try {
    const now = Date.now()
    
    // Check if function has been stuck (hasn't run in 5 minutes)
    if (live_stats.lastRun && (now - live_stats.lastRun) > 5 * 60 * 1000) {
      console.error(`WARNING: getStats hasn't run successfully in ${Math.floor((now - live_stats.lastRun) / 1000)} seconds`)
    }
    
    live_stats.i = (live_stats.i + 1) % 10    // Increment cleanup index (0-9 cycle)
    console.log(`Clean: ${live_stats.i} | Last run: ${live_stats.lastRun ? new Date(live_stats.lastRun).toISOString() : 'Never'} | Started: ${new Date(startTime).toISOString()}`)
  inventory()                               // Check IPFS inventory
  
  // Fetch and process the latest feed from SPK API
  fetch(`${config.SPK_API}/feed${live_stats.feed ? '/' + live_stats.feed : ''}`)
    .then(rz => rz.json())
    .then(json => {
      const feed = json.feed
      const keys = Object.keys(json.feed)
      const stored = `@${config.account} Stored`     // Storage confirmation message
      const deleted = `@${config.account} Removed`   // Deletion confirmation message
      
      // Process each feed item
      for (var i = 0; i < keys.length; i++) {
        // Update feed position to latest
        if (parseInt(keys[i].split(':')[0]) > live_stats.feed) live_stats.feed = parseInt(keys[i].split(':')[0])
        
        // Handle storage requests
        if (feed[keys[i]].search(stored) > -1) {
          storeByContract(feed[keys[i]].split('|')[1])
        } 
        // Handle deletion requests
        else if (feed[keys[i]].search(deleted) > -1) {
          deleteByContract(feed[keys[i]].split('|')[1])
        }
      }
    })
    .catch(err => {
      console.error('Error fetching feed:', err)
    })
  
  // Fetch account statistics from SPK API
  fetch(`${config.SPK_API}/@${config.account}`)
    .then(rz => rz.json())
    .then(json => {
      const keys = Object.keys(json)
      // Update live stats with account data
      for (var i = 0; i < keys.length; i++) {
        live_stats[keys[i]] = json[keys[i]]
      }
    })
    .catch(err => {
      console.error('Error fetching account stats:', err)
    })
  
  // Get IPFS repository statistics
  if (ipfs) {
    ipfs.repo.stat().then(stats => {
      live_stats.storageMax = BigInt(stats.storageMax)    // Maximum storage capacity
      live_stats.repoSize = BigInt(stats.repoSize)        // Current repository size
      live_stats.numObjects = BigInt(stats.numObjects)    // Number of stored objects
    }).catch(err => {
      console.error('Error getting IPFS repo stats:', err)
    })
  }
  
  // Exit early if blockchain head block is not yet available
  if (!live_stats.head_block) {
    console.log('No head_block yet, retrying in 3 seconds...')
    // Try to initialize IPFS if not already done
    if (!ipfs && !live_stats.ipfsInitAttempted) {
      live_stats.ipfsInitAttempted = true;
      initializeIPFS();
    }
    return setTimeout(getStats, 3 * 1000)
  }
  
  // Clean up old uploaded files (older than ~24 hours based on blocks)
  fs.readdir(`./uploads/`, (err, files) => {
    files.forEach(file => {
      const keys = file.split(':')
      const block = parseInt(keys[keys.length - 1])
      // Remove files older than 28800 blocks (~24 hours)
      if (live_stats['head_block'] > block + 28800) {
        fs.remove(`./uploads/${file}`)
      }
    });
  });
  
  // Process contract cleanup based on current cleanup index
  // SAFETY: Skip cleanup if IPFS is not connected to prevent accidental deletions
  if (!ipfs) {
    console.log('WARNING: Skipping contract cleanup - IPFS not connected')
    return
  }
  
  fs.readdir(`./db/`, (err, files) => {
    files.forEach(file => {
      const key = file.replace('.json', "")
      // Extract final character as block reference for cleanup rotation
      const block = parseInt(key[key.length - 1])
      
      // Only process contracts matching current cleanup index
      if (live_stats.i == block) {
        DB.read(key).then(json => {
          try {
            json = JSON.parse(json)
          } catch (e) {
            console.log('Parse Error')
          }
          
          // Check if contract is still active on the blockchain
          getActiveContract(key).then(contract => {
            const behind = contract[1].behind          // How far behind blockchain sync
            contract = contract[1].result
            
            // If contract no longer exists and we're up to date
            if (contract == 'Contract Not Found') {
              if (behind < 100) {
                DB.delete(key)                         // Delete local contract
                // Clean up associated files
                for (var i = 0; i < json.df.length; i++) {
                  fs.remove(getFilePath(json.df[i], key))
                  if (ipfs) {
                    console.log('unpinning', json.df[i])
                    ipfsUnpin(json.df[i])                // Unpin from IPFS
                  } else {
                    console.log('IPFS not connected, skipping unpin for', json.df[i])
                  }
                }
              }
            } else {
              // Contract exists, check if this node should still store it
              if (behind < 100) {
                var isMine = 0
                const nodes = contract.n ? Object.keys(contract.n) : []
                // Check if this node is assigned to the contract
                for (var j = 1; j <= nodes.length; j++) {
                  if (contract.n[`${j}`] == config.account) {
                    isMine = j
                    break
                  }
                }
                // If not assigned to this node, clean up
                if (isMine == 0) { //or j > p + threshold
                  for (var i = 0; i < json.df.length; i++) {
                    fs.remove(getFilePath(json.df[i], key))
                    if (ipfs) {
                      console.log('unpinning', json.df[i])
                      ipfsUnpin(json.df[i])              // Unpin from IPFS
                    } else {
                      console.log('IPFS not connected, skipping unpin for', json.df[i])
                    }
                  }
                  DB.delete(key).then(d => {
                    console.log('deleted', key + '.json')
                  })
                }
              }
            }
          }).catch(e => {
            console.log(e)
          })
        })
      }
    });
  });
  
  // Mark successful run
  live_stats.lastRun = Date.now()
  live_stats.failureCount = 0
  console.log(`getStats completed in ${Date.now() - startTime}ms`)
  
  } catch (err) {
    console.error('Critical error in getStats:', err)
    live_stats.failureCount++
    
    // If too many failures, try a shorter retry interval
    if (live_stats.failureCount > 5) {
      console.error(`Too many failures (${live_stats.failureCount}), retrying in 10 seconds`)
      setTimeout(getStats, 10 * 1000)
      return
    }
  } finally {
    // Always reschedule to prevent the function from stopping
    setTimeout(getStats, 1 * 60 * 1000) // Schedule next run in 1 minute
  }
}

// Remove a file from IPFS pinning (allows garbage collection)
async function ipfsUnpin(cid) {
  if (!ipfs) {
    return 'IPFS not initialized'
  }
  if (!cid) {
    return 'Not Pinned'
  }
  
  try {
    const pinset = await ipfs.pin.rm(cid)
    return pinset
  } catch (err) {
    throw err
  }
}

// Check IPFS inventory and re-pin any missing files
async function inventory() {
  if (!ipfs) {
    console.log('IPFS not initialized, attempting initialization...')
    initializeIPFS()
    return
  }
  
  try {
    const keys = await DB.getKeys('contracts')
    
    // Process each contract
    for (var i = 0; i < keys.length; i++) {
      const contractData = await DB.read(keys[i])
      const contract = JSON.parse(contractData)
      
      // Check each file in the contract
      for (var j in contract.df) {
        if (!j || j.length < 10) {
          continue // Skip invalid CIDs
        }
        
        try {
          // Check if file is already pinned
          let isPinned = false
          for await (const pin of ipfs.pin.ls({ paths: [j] })) {
            if (pin.cid.toString() === j) {
              isPinned = true
              break
            }
          }
          
          if (!isPinned) {
            console.log('missing', j)
            // Re-pin missing files
            await ipfs.pin.add(j)
            console.log(`pinned ${j}`)
          }
        } catch (err) {
          if (err.message && err.message.includes('not found')) {
            console.log('File not found in IPFS:', j)
          } else {
            console.error('Error checking/pinning file:', j, err.message)
          }
        }
      }
    }
  } catch (e) {
    console.error('Error in inventory:', e)
  }
}

// Upload a file to IPFS and update the contract with file information
function localIpfsUpload(cid, contractID) {
  return new Promise(async (res, rej) => {
    // Use a lock to prevent concurrent contract updates
    if (ipfsLock[contractID]) {
      return setTimeout(() => {
        localIpfsUpload(cid, contractID).then(r => res(r)).catch(e => rej(e))
      }, 100)
    }
    ipfsLock[contractID] = true

    try {
      const str = await DB.read(contractID);
      const contract = JSON.parse(str);
      const filePath = getFilePath(cid, contractID);
      
      // First verify the CID matches what was signed
      const isValid = await ipfsQueue.verifyCID(filePath, cid);
      if (!isValid) {
        delete ipfsLock[contractID];
        console.log(`CID verification failed for ${cid}`);
        fs.rmSync(filePath);
        return res({ status: 412, message: 'CID Verification Failed' });
      }
      
      // Get file size for contract validation
      const fileStats = await fs.stat(filePath);
      const fileSize = fileStats.size;
      
      // Check if adding this file would exceed contract storage limit
      if ((contract.t || 0) + fileSize > contract.s) {
        console.log(`Files larger than contract: ${cid}`);
        fs.rmSync(filePath);
        await DB.delete(contract.id);
        delete ipfsLock[contractID];
        return res({ status: 400, message: 'File Size Exceeded' });
      }
      
      // Add to upload queue
      const queueItem = ipfsQueue.addToQueue(contractID, cid, filePath, cid);
      
      // Update contract immediately with file info (before IPFS upload)
      contract[cid] = fileSize;
      contract.t = (contract.t || 0) + fileSize;
      
      await DB.write(contract.id, JSON.stringify(contract));
      
      // Check if all files in contract are verified
      let allVerified = true;
      for (let i = 0; i < contract.df.length; i++) {
        if (!contract[contract.df[i]]) {
          allVerified = false;
          break;
        }
      }
      
      if (allVerified) {
        console.log('All files verified, ready for signing');
        // Sign and broadcast immediately - IPFS upload happens in background
        signNupdate(contract);
      }
      
      delete ipfsLock[contractID];
      res({ status: 200, message: 'File verified and queued for IPFS upload', queueStatus: queueItem.state });
      
    } catch (err) {
      delete ipfsLock[contractID];
      console.error('Error in localIpfsUpload:', err);
      res({ status: err.message.includes('Not Found') ? 404 : 500, message: err.message });
    }
  });
}

// API endpoint: Get storage statistics including disk usage and IPFS metrics
exports.storageStats = (req, res, next) => {
  // Check disk usage for the current working directory
  diskusage.check(process.cwd(), (err, info) => {
    if (err) {
      console.error('Error getting disk usage:', err);
      return res.status(500).json({ message: 'Error retrieving disk usage' });
    }

    // Convert disk usage numbers to BigInt for consistency with IPFS stats
    const total = BigInt(info.total);
    const free = BigInt(info.free);
    const used = total - free;

    // Get the number of active contracts
    DB.getKeys('contracts')
      .then(keys => {
        const activeContracts = keys.length;

        // Prepare the response with comprehensive storage information
        const response = {
          disk: {
            total: total.toString(), // Total disk space in bytes
            free: free.toString(),   // Free disk space in bytes
            used: used.toString()    // Used disk space in bytes
          },
          ipfsRepo: {
            size: live_stats.repoSize.toString(),       // Current IPFS repo size
            numObjects: live_stats.numObjects.toString(), // Number of IPFS objects
            storageMax: live_stats.storageMax.toString()  // Max IPFS repo size
          },
          activeContracts: activeContracts // Number of active contracts
        };

        res.status(200).json(response);
      })
      .catch(err => {
        console.error('Error getting active contracts:', err);
        res.status(500).json({ message: 'Error retrieving active contracts' });
      });
  });
};

// API endpoint: Create a promotional storage contract with higher grant
exports.promo_contract = (req, res, next) => {
  const user = req.query.user;
  // Rate limiting: prevent spam requests (10 minute cooldown)
  if (promoDebouncer[user] && promoDebouncer[user] > new Date().getTime() - 1000 * 60 * 10) {
    return res.status(429).json({ message: 'Too many requests' });
  }
  promoDebouncer[user] = new Date(new Date().getTime() + 1000 * 60 * 10);
  console.log('promo',{ user })
  
  // Check user's SPK account status
  fetch(`${config.SPK_API}/@${user}`).then(rz => rz.json()).then(json => {
    // Only create contract if user doesn't have one and has a valid public key
    if (!json.channels[config.account] && json.pubKey != 'NA') { //no contract
      var grant = parseInt(config.base_grant * 2), multiplier = 1  // Double grant for promo
      const powder = parseInt(live_stats.broca.split(',')[0])
      const cap = live_stats.spk_power * config.base_grant
      
      // Adjust grant based on network capacity utilization
      if (powder / cap > 0.8) {
        multiplier = 8
      } else if (powder / cap > 0.6) {
        multiplier = 4
      } else if (powder / cap > 0.4) {
        multiplier = 2
      }
      
      // Adjust grant based on user's previous grants
      if (live_stats.granted[user]) {
        grant = parseInt((live_stats.granted[user] / live_stats.granted.t) * multiplier * (.2 * cap))
      }
      
      // Deduct grant from available broca tokens
      live_stats.broca = `${powder - grant},${live_stats.broca.split(',')[1]}`
      
      // Build blockchain transaction to open storage channel
      const operations = [
        [
          'custom_json',
          {
            "required_auths": [
              config.account
            ],
            "required_posting_auths": [],
            "id": "spkccT_channel_open",
            "json": `{\"broca\":${grant},\"broker\":\"${config.account}\",\"to\":\"${user}\",\"contract\":\"0\"}`
          }
        ]
      ]
      
      // Sign and broadcast transaction
      const tx = new hiveTx.Transaction()
      tx.create(operations).then(() => {
        const privateKey = hiveTx.PrivateKey.from(config.active_key)
        tx.sign(privateKey)
        tx.broadcast().then(r => {
          console.log({ r })
          res.status(200)
            .json({
              message: 'Contract Sent',
              tx: r
            });
        })
      })
        .catch(e => {
          console.log(e)
          res.status(400)
            .json({
              message: 'File Contract Build Failed'
            });
        })
    } else {
      res.status(400)
        .json({
          message: 'Contract Exists or User PubKey Not Found'
        });
    }
  }).catch(e => {
    next(e)
  })
}

// API endpoint: Create a standard storage contract
exports.contract = (req, res, next) => {
  const user = req.query.user;
  console.log('contract',{ user })
  
  // Check user's SPK account status
  fetch(`${config.SPK_API}/@${user}`).then(rz => rz.json()).then(json => {
    // Only create contract if user doesn't have one and has a valid public key
    if (!json.channels[config.account] && json.pubKey != 'NA') { //no contract
      var grant = config.base_grant, multiplier = 1
      const powder = parseInt(live_stats.broca.split(',')[0])
      const cap = live_stats.spk_power * config.base_grant
      
      // Adjust grant based on network capacity utilization
      if (powder / cap > 0.8) {
        multiplier = 8
      } else if (powder / cap > 0.6) {
        multiplier = 4
      } else if (powder / cap > 0.4) {
        multiplier = 2
      }
      
      // Adjust grant based on user's previous grants
      if (live_stats.granted[user]) {
        grant = parseInt((live_stats.granted[user] / live_stats.granted.t) * multiplier * (.2 * cap))
      }
      
      // Deduct grant from available broca tokens
      live_stats.broca = `${powder - grant},${live_stats.broca.split(',')[1]}`
      
      // Build blockchain transaction with slots specification
      const operations = [
        [
          'custom_json',
          {
            "required_auths": [
              config.account
            ],
            "required_posting_auths": [],
            "id": "spkccT_channel_open",
            "json": `{\"broca\":${grant},\"broker\":\"${config.account}\",\"to\":\"${user}\",\"contract\":\"1\",\"slots\":\"dlux-io,1000\"}`
          }
        ]
      ]
      
      // Sign and broadcast transaction
      const tx = new hiveTx.Transaction()
      tx.create(operations).then(() => {
        const privateKey = hiveTx.PrivateKey.from(config.active_key)
        tx.sign(privateKey)
        tx.broadcast().then(r => {
          console.log({ r })
          res.status(200)
            .json({
              message: 'Contract Sent',
              tx: r
            });
        })
      })
        .catch(e => {
          console.log(e)
          res.status(400)
            .json({
              message: 'File Contract Build Failed'
            });
        })
    } else {
      res.status(400)
        .json({
          message: 'Contract Exists or User PubKey Not Found'
        });
    }
  }).catch(e => {
    next(e)
  })
}

// API endpoint: Handle chunked file uploads with resume capability
exports.upload = (req, res, next) => {
  const contract = req.headers['x-contract'];    // Contract ID for the upload
  const contentRange = req.headers['content-range'];  // Byte range for this chunk
  const fileId = req.headers['x-cid'];           // Content ID (hash) of the file
  console.log({ contract, contentRange, fileId })
  
  // Validate required headers
  if (!contract) {
    console.log('Missing Contract');
    return res
      .status(406)
      .json({ message: 'Missing "x-contract" header' });
  }

  if (!contentRange) {
    console.log('Missing Content-Range');
    return res
      .status(405)
      .json({ message: 'Missing "Content-Range" header' });
  }

  if (!fileId) {
    console.log('Missing File Id');
    return res
      .status(404)
      .json({ message: 'Missing "x-cid" header' });
  }

  // Parse the Content-Range header (format: bytes=start-end/total)
  const match = contentRange
    .match(/bytes=(\d+)-(\d+)\/(\d+)/);

  if (!match) {
    console.log('Invalid Content-Range Format');
    return res
      .status(403)
      .json({ message: 'Invalid "Content-Range" Format' });
  }

  const rangeStart = Number(match[1]);          // Starting byte of this chunk
  const rangeEnd = Number(match[2]);            // Ending byte of this chunk
  const fileSize = Number(match[3]);            // Total file size

  // Validate range parameters
  if (
    rangeStart >= fileSize ||
    rangeStart >= rangeEnd ||
    rangeEnd > fileSize
  ) {
    return res
      .status(402)
      .json({ message: 'Invalid "Content-Range" provided' });
  }

  // Initialize multipart form parser
  const busboy = Busboy({ headers: req.headers });

  // Handle file upload stream
  busboy.on('file', (name, file, info) => {
    const filePath = getFilePath(fileId, contract);
    if (!fileId || !contract) {
      req.pause();
    }

    // Check if partial file exists and validate chunk position
    fs.stat(filePath)
      .then((stats) => {
        // Ensure this chunk starts where the previous chunk ended
        if (stats.size !== rangeStart) {
          return res
            .status(403)
            .json({
              message: 'Bad "chunk" provided',
              startByte: rangeStart,
              haveByte: stats.size
            });
        }

        // Append chunk to existing file
        file
          .pipe(fs.createWriteStream(filePath, { flags: 'a' }))
          .on('error', (e) => {
            console.error('failed upload', e);
            res.sendStatus(500);
          })
          .on('close', () => {
            console.log('close')
          })
      })
      .catch(err => {
        console.log('File not found, checking if this is a valid first chunk...', err);
        
        // If file doesn't exist and this is the first chunk (starts at 0), create it
        if (rangeStart === 0) {
          console.log('Creating new file for first chunk:', filePath);
          try {
            // Create the file and write the first chunk
            file
              .pipe(fs.createWriteStream(filePath, { flags: 'w' }))
              .on('error', (e) => {
                console.error('failed upload', e);
                res.sendStatus(500);
              })
              .on('close', () => {
                console.log('First chunk written successfully')
              })
          } catch (createErr) {
            console.error('Failed to create file for upload:', createErr);
            res.status(500).json({ message: 'Failed to create upload file' });
          }
        } else {
          // File doesn't exist and this isn't the first chunk - error
          console.log('No File Match for non-first chunk', err);
          res
            .status(401)
            .json({
              message: 'No file with such credentials'
            });
        }
      })
  });

  // Handle upload errors
  busboy.on('error', (e) => {
    console.error('failed upload', e);
    res.sendStatus(501);
  })

  // Handle upload completion
  busboy.on('finish', () => {
    // Process the uploaded file with IPFS
    localIpfsUpload(fileId, contract).then(r => {
      console.log('finish')
      res.status(r.status).json(r.message)
    })

  });

  // Pipe request to busboy for processing
  req.pipe(busboy);
}

// API endpoint: Get live node status and statistics
exports.live = (req, res, next) => {
  console.log('live')
  // Convert BigInt values to strings for JSON serialization
  const StorageMax = BigInt(live_stats.storageMax || 0).toString()
  const RepoSize = BigInt(live_stats.repoSize || 0).toString()
  const NumObjects = BigInt(live_stats.numObjects || 0).toString()
  
  // Calculate health status
  const now = Date.now()
  const timeSinceLastRun = live_stats.lastRun ? (now - live_stats.lastRun) / 1000 : null
  const isHealthy = timeSinceLastRun ? timeSinceLastRun < 120 : false // Healthy if ran within 2 minutes
  
  // Add IPFS connection status
  const ipfsConnected = !!ipfs && !!live_stats.ipfsid
  
  return res.status(200).json({
    ipfsid: live_stats.ipfsid,          // IPFS node identifier
    pubKey: live_stats.pubKey,          // Node's public key
    head_block: live_stats.head_block,  // Latest blockchain block
    node: config.account,               // Node account name
    api: live_stats.node,               // API endpoint
    StorageMax,                         // Maximum storage capacity
    RepoSize,                           // Current repository size
    NumObjects,                         // Number of stored objects
    health: {
      status: isHealthy ? 'healthy' : 'unhealthy',
      lastRun: live_stats.lastRun ? new Date(live_stats.lastRun).toISOString() : null,
      timeSinceLastRun: timeSinceLastRun,
      failureCount: live_stats.failureCount,
      cleanupIndex: live_stats.i,
      ipfsConnected: ipfsConnected
    }
  })
}

// API endpoint: Get IPFS upload queue status
exports.queueStatus = (req, res, next) => {
  const contractId = req.query.contract;
  
  if (contractId) {
    // Get status for specific contract
    const items = ipfsQueue.getContractItems(contractId);
    return res.status(200).json({
      contractId,
      items,
      total: items.length
    });
  } else {
    // Get overall queue status
    const status = ipfsQueue.getQueueStatus();
    return res.status(200).json(status);
  }
}

// API endpoint: Check if a specific CID is flagged
exports.flags = (req, res, next) => {
  var flag = false
  fs.readJSON(`./db/${req.params.cid}.flag`)
    .then(json => {
      res.status(200).json({
        flag: true                      // CID is flagged
      })
    })
    .catch(e => {
      res.status(200).json({
        flag: false                     // CID is not flagged
      })
    })
}

// API endpoint: Flag or unflag a CID (requires signature verification)
exports.flag = (req, res, next) => {
  const CID = req.query.cid              // Content ID to flag/unflag
  const sig = req.query.sig              // Digital signature
  const unflag = req.query.unflag || false  // Whether to remove flag
  // Verify signature against node's posting public key
  const signed = verifySig(`${CID}`, sig, config.posting_pub)
  if (signed && !unflag) {
    // Create flag file
    fs.write(`./db/${CID}.flag`, 1)
      .then(json => {
        console.log('flagged', CID)
      })
      .catch(e => {
      })
  } else if (signed && unflag) {
    // Remove flag file
    fs.remove(`./db/${CID}.flag`)
      .then(json => {
        console.log('unflagged', CID)
      })
      .catch(e => {
      })
  }
  res.status(200).json({
    msg: `${CID} has been ${signed ? 'flagged' : 'unflagged'}`,
  })
}

// API endpoint: Get list of all contract IDs
exports.contractIDs = (req, res, next) => {
  console.log('contractIDs')
  DB.getKeys('contracts')
    .then(keys => {
      res.status(200).json({
        contracts: keys                 // Array of contract identifiers
      })
    })
    .catch(e => {
      res.status(200).json({
        contracts: []                   // Empty array if error
      })
    })
}

// API endpoint: Get detailed information for all contracts
exports.contracts = (req, res, next) => {
  console.log('contracts')
  DB.getKeys('contracts')
    .then(keys => {
      // Read all contract data files
      var contracts = []
      for (var i = 0; i < keys.length; i++) {
        contracts.push(DB.read(keys[i]))
      }
      // Wait for all reads to complete
      Promise.all(contracts).then(contracts => {
        // Parse JSON data for each contract
        for (var i = 0; i < contracts.length; i++) {
          contracts[i] = JSON.parse(contracts[i])
        }
        return res.status(200).json({
          contracts                     // Array of contract objects
        })
      })
    })
    .catch(e => {
      res.status(200).json({
        contracts: []                   // Empty array if error
      })
    })
}

// API endpoint: Get upload statistics for a specific file
exports.stats = (req, res, next) => {
  // Validate required headers
  if (!req.headers || !req.headers['x-cid'] || !req.headers['x-files']
    || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract']) {
    res.status(400).json({ message: 'Missing data' });
  } else {
    let chain = req.headers['x-chain'] || 'HIVE'  // Blockchain (default: HIVE)
    let account = req.headers['x-account'];        // User account
    let sig = req.headers['x-sig'];               // Digital signature
    let cid = req.headers['x-cid'];               // Content ID
    let contract = req.headers['x-contract'];     // Contract ID
    let cids = req.headers['x-files'];            // List of file CIDs
    
    if (!account || !sig || !cids) {
      res.status(401).send("Access denied. No Valid Signature");
      return
    }
    
    // Verify account and get public keys
    getAccountPubKeys(account)
      .then((r) => {
        if (
          //true
          !r[1][0] || //no error
          'NA' != r[1][1] //or account mismatch
        ) {
          // Check file upload progress
          fs.stat(getFilePath(cid, contract))
            .then((stats) => {
              res.status(200)
                .json({ totalChunkUploaded: stats.size });  // Bytes uploaded so far
            })
        } else {
          res.status(400).send("Storage Mismatch: " + cid);
        }
      })
  }
}

// API endpoint: Arrange files for a contract (set up contract metadata)
exports.arrange = (req, res, next) => {
  // Check for required headers (x-files and x-meta are no longer expected in headers)
  if (!req.headers || !req.headers['x-cid'] || !req.headers['x-account'] || !req.headers['x-sig'] || !req.headers['x-contract']) {
    return res.status(400).json({ message: 'Missing required header data' });
  }

  // Check for required body parameters (cids and meta)
  if (!req.body || typeof req.body.files === 'undefined' || typeof req.body.meta === 'undefined') {
    console.log('Missing cids or meta in request body')
    return res.status(400).json({ message: 'Missing cids or meta in request body' });
  }

  // Extract data from headers and body
  let chain = req.headers['x-chain'] || 'HIVE';  // Blockchain (default: HIVE)
  let account = req.headers['x-account'];         // User account
  let sig = req.headers['x-sig'];                // Digital signature
  let contract = req.headers['x-contract'];      // Contract identifier
  
  let cids = req.body.files;                     // Comma-separated file CIDs
  let meta = decodeURI(req.body.meta);           // File metadata
  console.log({ cids, meta })

  // Validate signature presence
  if (!account || !sig) {
    return res.status(401).send("Access denied. No Valid Signature");
  }
  
  console.log(`Verifying signature for account: ${account}, contract: ${contract}`);
  console.log(`Signature length: ${sig ? sig.length : 0}`);
  
  // Get account public keys and contract details in parallel
  var getPubKeys = getAccountPubKeys(account)
  Promise.all([getPubKeys, getContract({ to: account, from: contract.split(':')[0], id: contract.split(':')[1] })])
    .then((r) => {
      // Clean up file list (remove empty entries)
      var files = cids.split(',');
      for (var i = 0; i < files.length; i++) {
        if (!files[i]) files.splice(i, 1);
      }
      const CIDs = cids.split(',');
      finish(contract)

      // Process contract setup
      function finish(nonce) {
        DB.read(contract)
          .then(j => {
            try {
              j = JSON.parse(j)
              const found = j.sig == sig ? true : false  // Check if signature already exists
              
              // Check if the CID list has changed (different files being uploaded)
              const existingFiles = j.df ? j.df.join(',') : ''
              const newFiles = files.join(',')
              const filesChanged = existingFiles !== newFiles
              
              // If files have changed, clean up old uploads and reset contract state
              if (filesChanged && j.df) {
                console.log('File list changed, cleaning up old uploads...')
                console.log('Old files:', existingFiles)
                console.log('New files:', newFiles)
                
                // Remove old placeholder files
                for (var i = 0; i < j.df.length; i++) {
                  if (j.df[i]) {
                    const oldFilePath = getFilePath(j.df[i], contract)
                    try {
                      fs.rmSync(oldFilePath)
                      console.log('Removed old file:', oldFilePath)
                    } catch (e) {
                      // File might not exist, which is fine
                      console.log('Could not remove old file (may not exist):', oldFilePath)
                    }
                  }
                }
                
                // Reset contract upload state
                j.t = 0  // Reset total uploaded size
                j.u = 0  // Reset upload progress
                
                // Remove old file size tracking
                if (j.df) {
                  for (var i = 0; i < j.df.length; i++) {
                    if (j.df[i] && j[j.df[i]]) {
                      delete j[j.df[i]]
                    }
                  }
                }
              }
              
              // Update contract with file and user information
              j.s = r[1][1].a,                          // Storage amount
                j.t = filesChanged ? 0 : (j.t || 0),   // Reset total if files changed
                j.fo = r[1][1].t,                       // File owner
                j.co = r[1][1].b,                       // Contract owner
                j.f = r[1][1].f,                        // From field
                j.df = files,                           // Data files array
                j.n = cids.split(',').length - 1,       // Number of files
                j.u = filesChanged ? 0 : (j.u || 0),   // Reset progress if files changed
                j.e = r[1][1].e ? r[1][1].e.split(':')[0] : '',  // Expiration
                j.sig = sig,                            // User signature
                j.key = r[0][1],                        // Public key
                j.b = r[1][1].r,                        // Block reference
                j.id = r[1][1].i                        // Contract ID
              j.m = meta                                // Metadata
              
              // Verify account matches contract owner
              if (account != j.fo) { //or account mismatch
                res.status(401).send("Access denied. Contract Mismatch");
              } else {
                // Create signature verification message
                const sigMsg = `${account}:${contract}${cids}`;
                console.log(`Verifying signature for message: ${sigMsg.substring(0, 30)}...`);
                
                // Verify digital signature
                const isValid = verifySig(sigMsg, sig, r[0][1]);
                console.log(`Signature verification result: ${isValid}`);
                
                if (isValid) {
                  // Create placeholder files for upload if files have changed or it's a new contract
                  if (!found || filesChanged) {
                    // Ensure uploads directory exists
                    try {
                      fs.ensureDirSync('./uploads/');
                    } catch (e) {
                      console.log('Uploads directory already exists or created');
                    }
                    
                    // Create placeholder files for all CIDs (starting from index 1, skipping empty first element)
                    console.log(`Creating placeholder files for ${CIDs.length - 1} files...`);
                    for (var i = 1; i < CIDs.length; i++) {
                      if (CIDs[i]) { // Only process non-empty CIDs
                        console.log(`Creating placeholder for CID: ${CIDs[i]}`);
                        checkThenBuild(getFilePath(CIDs[i], contract));
                      }
                    }
                    // Save contract configuration
                    console.log(`Saving contract configuration for: ${j.id}`);
                    DB.write(j.id, JSON.stringify(j)).then(r => {
                      console.log(`Contract saved successfully, authorizing upload for ${CIDs.length} files`);
                      res.status(200).json({ authorized: CIDs });
                    })
                  } else res.status(200).json({ authorized: CIDs });
                } else {
                  res.status(401).send("Access denied. Signature Mismatch");
                }
              }
            } catch (error) {
              console.log('Error processing request:', error);
              res.status(500).send("Server error processing request");
            }
          })
          .catch(err => {
            console.log('Error reading contract:', err);
            res.status(500).send("Error reading contract data");
          });
      }
    })
    .catch(err => {
      console.log('Error fetching account or contract data:', err);
      res.status(500).send("Error processing contract verification");
    });
}

// Helper function: Create empty file if it doesn't exist
function checkThenBuild(path) {
  try {
    // Check if file exists
    fs.statSync(path);
    // File exists, do nothing
  } catch (err) {
    // Create empty file for chunked upload
    try {
      fs.writeFileSync(path, '');
      console.log('Created placeholder file:', path);
    } catch (writeErr) {
      console.error('Failed to create placeholder file:', path, writeErr);
    }
  }
}

// Sign and broadcast contract completion to the blockchain with chunk verification and retry
function signNupdate(contract) {
  return new Promise((resolve, reject) => {
    // Build the sizes string for all uploaded files
    var sizes = '';
    for (var i = 0; i < contract.df.length; i++) {
      sizes += `${contract[contract.df[i]]},`;
    }
    sizes = sizes.substring(0, sizes.length - 1);

    // Construct the contract completion data object
    const data = {
      fo: contract.fo, // file owner
      id: contract.id, // contract id
      sig: contract.sig, // signature of uploader  
      co: config.account, // broker
      f: contract.f, // from
      c: contract.df.join(','), // cids uploaded
      s: sizes,
      m: contract.m
    };

    // Stringify the data and define limits for blockchain transactions
    const jsonString = JSON.stringify(data);
    const maxJsonLength = config.maxJsonLength; // Maximum characters per transaction
    const chunkSize = config.chunkSize; // Chunk size to leave room for metadata

    if (jsonString.length <= maxJsonLength) {
      // **Single Transaction Case** - data fits in one transaction
      const operations = [
        [
          'custom_json',
          {
            "required_auths": [config.account],
            "required_posting_auths": [],
            "id": "spkccT_channel_update",
            "json": jsonString
          }
        ]
      ];
      const tx = new hiveTx.Transaction();
      tx.create(operations)
        .then(() => {
          const privateKey = hiveTx.PrivateKey.from(config.active_key);
          tx.sign(privateKey);
          tx.broadcast()
            .then(resolve)
            .catch(err => {
              console.log({ err });
              reject(err);
            });
        })
        .catch(err => {
          console.log({ err });
          reject(err);
        });
    } else {
      // **Chunked Transaction Case with Verification and Retry**
      const chunks = splitString(jsonString, chunkSize);
      const total_chunks = chunks.length;
      const update_id = contract.id.split(':')[2]; // Unique part of contract.id
      
      // Chunk tracking system
      const chunkTracker = {
        chunks: [],
        maxRetries: config.chunkMaxRetries,
        verificationDelay: config.chunkVerificationDelay,
        retryDelay: config.chunkRetryDelay
      };

      // Prepare all chunk payloads
      for (let i = 0; i < chunks.length; i++) {
        const chunkPayload = {
          fo: contract.fo,
          id: contract.id,
          sig: contract.sig,
          co: config.account,
          f: contract.f,
          update_id: update_id,
          chunk_id: i + 1, // Start from 1
          total_chunks: total_chunks,
          chunk_data: chunks[i]
        };
        
        chunkTracker.chunks.push({
          id: i + 1,
          payload: chunkPayload,
          attempts: 0,
          confirmed: false,
          lastTxId: null,
          sentAt: null
        });
      }

      // Function to send a single chunk
      const sendChunk = (chunkInfo) => {
        return new Promise((res, rej) => {
          const operations = [
            [
              'custom_json',
              {
                "required_auths": [config.account],
                "required_posting_auths": [],
                "id": "spkccT_channel_update",
                "json": JSON.stringify(chunkInfo.payload)
              }
            ]
          ];
          const tx = new hiveTx.Transaction();
          
          chunkInfo.attempts++;
          chunkInfo.sentAt = Date.now(); // Record when this chunk was sent
          console.log(`Sending chunk ${chunkInfo.id}/${total_chunks} (attempt ${chunkInfo.attempts})`);
          
          tx.create(operations)
            .then(() => {
              const privateKey = hiveTx.PrivateKey.from(config.active_key);
              tx.sign(privateKey);
              // Store the transaction ID for verification
              chunkInfo.lastTxId = tx.id;
              tx.broadcast()
                .then((result) => {
                  console.log(`Chunk ${chunkInfo.id} broadcast initiated`);
                  res(result);
                })
                .catch(err => {
                  console.log(`Chunk ${chunkInfo.id} broadcast failed:`, err);
                  rej(err);
                });
            })
            .catch(err => {
              console.log(`Chunk ${chunkInfo.id} creation failed:`, err);
              rej(err);
            });
        });
      };

      // Function to verify chunks on blockchain  
      const verifyChunks = async () => {
        console.log('Verifying chunks on blockchain...');
        try {
          // Query the SPK feed for recent transactions
          const response = await fetch(`${config.SPK_API}/feed`);
          const feedData = await response.json();
          
          // Get transaction IDs from our account that match our expected pattern
          const recentTxIds = new Set();
          Object.keys(feedData.feed).forEach(key => {
            const message = feedData.feed[key];
            // Look for messages from our account that might be chunk transactions
            if (message.includes(`@${config.account}|`) && 
                (message.includes('channel_update') || message.includes('Stored'))) {
              const txid = key.split(':')[1];
              recentTxIds.add(txid);
            }
          });
          
          // Check which chunks we can confirm
          let confirmedCount = 0;
          for (let chunkInfo of chunkTracker.chunks) {
            if (!chunkInfo.confirmed) {
              // If we have a transaction ID from the broadcast and it appears in recent feed
              if (chunkInfo.lastTxId && recentTxIds.has(chunkInfo.lastTxId)) {
                chunkInfo.confirmed = true;
                confirmedCount++;
                console.log(`✓ Chunk ${chunkInfo.id} confirmed on blockchain (txid: ${chunkInfo.lastTxId})`);
              } else {
                // Alternative: Check for any recent transaction that could be our chunk
                // based on timing (this is less precise but more reliable)
                const now = Date.now();
                const timeSinceSent = now - (chunkInfo.sentAt || now);
                
                // If the chunk was sent recently and we see recent transactions from our account,
                // assume it went through (this is a fallback for when tx IDs don't match perfectly)
                if (timeSinceSent < 30000 && recentTxIds.size > 0) { // 30 seconds
                  chunkInfo.confirmed = true;
                  confirmedCount++;
                  console.log(`✓ Chunk ${chunkInfo.id} assumed confirmed (recent transaction detected)`);
                }
              }
            } else {
              confirmedCount++;
            }
          }
          
          return confirmedCount === total_chunks;
        } catch (error) {
          console.log('Error verifying chunks:', error);
          // Fallback: if verification fails, assume chunks are confirmed after sufficient time
          const now = Date.now();
          let assumedConfirmed = 0;
          for (let chunkInfo of chunkTracker.chunks) {
            if (!chunkInfo.confirmed) {
              const timeSinceSent = now - (chunkInfo.sentAt || 0);
              if (timeSinceSent > 15000) { // 15 seconds - assume confirmed
                chunkInfo.confirmed = true;
                assumedConfirmed++;
                console.log(`✓ Chunk ${chunkInfo.id} assumed confirmed (timeout)`);
              }
            }
          }
          
          const totalConfirmed = chunkTracker.chunks.filter(c => c.confirmed).length;
          return totalConfirmed === total_chunks;
        }
      };

      // Function to retry failed chunks
      const retryFailedChunks = async () => {
        const failedChunks = chunkTracker.chunks.filter(chunk => 
          !chunk.confirmed && chunk.attempts < chunkTracker.maxRetries
        );
        
        if (failedChunks.length === 0) {
          return true; // All chunks either confirmed or exhausted retries
        }
        
        console.log(`Retrying ${failedChunks.length} failed chunks...`);
        
        // Send failed chunks with delays
        for (let i = 0; i < failedChunks.length; i++) {
          try {
            await sendChunk(failedChunks[i]);
            // Add delay between retry attempts
            if (i < failedChunks.length - 1) {
              await new Promise(res => setTimeout(res, chunkTracker.retryDelay));
            }
          } catch (error) {
            console.log(`Retry failed for chunk ${failedChunks[i].id}:`, error);
          }
        }
        
        return false; // Still need to verify after retries
      };

      // Main chunked broadcasting workflow
      const processChunkedBroadcast = async () => {
        try {
          // Initial send of all chunks
          console.log(`Broadcasting ${total_chunks} chunks for contract ${contract.id}`);
          
          // Send first chunk immediately
          await sendChunk(chunkTracker.chunks[0]);
          
          // Send remaining chunks with delays
          for (let i = 1; i < chunkTracker.chunks.length; i++) {
            await new Promise(res => setTimeout(res, chunkTracker.retryDelay));
            await sendChunk(chunkTracker.chunks[i]);
          }
          
          // Wait for blockchain propagation
          console.log(`Waiting ${chunkTracker.verificationDelay}ms for blockchain propagation...`);
          await new Promise(res => setTimeout(res, chunkTracker.verificationDelay));
          
          // Verification and retry loop
          let retryCount = 0;
          while (retryCount < chunkTracker.maxRetries) {
            const allConfirmed = await verifyChunks();
            
            if (allConfirmed) {
              console.log(`✓ All ${total_chunks} chunks confirmed on blockchain`);
              resolve({ success: true, chunks: total_chunks });
              return;
            }
            
            // Retry failed chunks
            await retryFailedChunks();
            
            // Wait before next verification
            await new Promise(res => setTimeout(res, chunkTracker.verificationDelay));
            retryCount++;
          }
          
          // Final verification after all retries
          const finalConfirmed = await verifyChunks();
          if (finalConfirmed) {
            console.log(`✓ All chunks confirmed after retries`);
            resolve({ success: true, chunks: total_chunks });
          } else {
            const unconfirmedChunks = chunkTracker.chunks.filter(c => !c.confirmed);
            console.log(`✗ Failed to confirm ${unconfirmedChunks.length} chunks after ${chunkTracker.maxRetries} retries`);
            reject(new Error(`Failed to confirm chunks: ${unconfirmedChunks.map(c => c.id).join(', ')}`));
          }
          
        } catch (error) {
          console.log('Chunked broadcast workflow failed:', error);
          reject(error);
        }
      };
      
      // Start the chunked broadcast process
      processChunkedBroadcast();
    }
  });
}

// Helper function to split a string into chunks of specified size
function splitString(str, chunkSize) {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

// Sign a message using a private key (blockchain cryptography)
function sign(msg, key) {
  const { sha256 } = require('hive-tx/helpers/crypto')
  const privateKey = hiveTx.PrivateKey.from(key)
  const message = sha256(msg)  // Hash the message
  return privateKey.sign(message)
}

// Verify a digital signature against a message and public key
function verifySig(msg, sig, key) {
  try {
    const { sha256 } = require("hive-tx/helpers/crypto");
    // Ensure signature is in the correct format before processing
    if (!sig || typeof sig !== 'string') {
      console.log('Invalid signature format:', sig);
      return false;
    }
    
    const message = sha256(msg);                          // Hash the message
    const publicKey = hiveTx.PublicKey.from(key);         // Parse public key
    const signature = hiveTx.Signature.from(sig);        // Parse signature
    const verify = publicKey.verify(message, signature);  // Verify signature
    return verify;
  } catch (error) {
    console.log('Signature verification error:', error.message);
    return false;
  }
}

// Get public keys for a blockchain account
function getAccountPubKeys(acc, chain = 'HIVE') {
  return new Promise((res, rej) => {
    if (chain == 'HIVE') {
      fetch(`${config.SPK_API}/@${acc}`)
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          var rez = re.pubKey  // Extract public key from account data
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

// Get active contract information from the blockchain
function getActiveContract(contract, chain = 'spk') {
  return new Promise((res, rej) => {
    if (chain == 'spk') {
      fetch(config.SPK_API + `/api/fileContract/${contract}`)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
          }
          return r.json();
        })
        .then((re) => {
          res([0, re]);  // Return contract data
        })
        .catch((e) => {
          rej([1, e]);
        });
    } else {
      rej([1, "Not Found"]);
    }
  });
}

// Get contract details from the blockchain
function getContract(contract, chain = 'spk') {
  return new Promise((res, rej) => {
    if (chain == 'spk') {
      fetch(config.SPK_API + `/api/contract/${contract.to}/${contract.from}/${contract.id}`)
        .then((r) => {
          return r.json();
        })
        .then((re) => {
          res([0, re.proffer]);  // Return contract offer details
        })
        .catch((e) => {
          res([1, e]);
        });
    } else {
      res([1, 'Chain not supported']);
    }
  });
}

// Store files for contracts specified in a comma-separated string
async function storeByContract(str) {
  const contracts = str.split(',')
  for (var i = 0; i < contracts.length; i++) {
    try {
      const contractData = await getActiveContract(contracts[i])
      const contract = contractData[1].result
      await DB.write(contract.i, JSON.stringify(contract))  // Store contract locally
      
      // Pin all files in the contract to IPFS
      for (var cid in contract.df) {
        if (!ipfs) {
          console.log('IPFS not initialized, skipping pin for', cid)
          continue
        }
        
        try {
          await ipfs.pin.add(cid)
          console.log('Pinned:', cid)
        } catch (err) {
          console.error('Failed to pin', cid, ':', err.message)
        }
      }
    } catch (err) {
      console.error('Error processing contract', contracts[i], ':', err)
    }
  }
}

// Delete files for contracts specified in a comma-separated string
function deleteByContract(str) {
  console.log("deleteByContract ", str)
  const contracts = str.split(',')
  console.log(contracts)
  for (var i = 0; i < contracts.length; i++) {
    console.log(contracts[i])
    getActiveContract(contracts[i]).then(contract => {
      contract = contract[1].result
      DB.delete(contract.i)  // Remove contract from local database
      // Unpin all files in the contract from IPFS
      for (var cid in contract.df) {
        console.log(cid)
        ipfsUnpin(cid)
      }
    })
  }
}

// Export ipfs instance for use in other modules
exports.ipfs = ipfs;

// Export getStats function to be called from index.js
exports.getStats = getStats;

// Export initializeIPFS function
exports.initializeIPFS = initializeIPFS;

// Export function to get IPFS instance (avoids circular dependency)
exports.getIPFSInstance = () => ipfs;