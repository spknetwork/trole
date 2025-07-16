const fs = require('fs-extra');
const IpfsOnlyHash = require('ipfs-only-hash');
const { EventEmitter } = require('events');

// Shared upload queue
const uploadQueue = [];
const uploadInProgress = new Map();
const queueEvents = new EventEmitter();

// Maximum concurrent uploads
const MAX_CONCURRENT_UPLOADS = 3;

// Queue states
const QUEUE_STATES = {
  PENDING: 'pending',
  VERIFYING: 'verifying',
  UPLOADING: 'uploading',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Add a file to the upload queue
function addToQueue(contractId, cid, filePath, expectedCid) {
  const queueItem = {
    contractId,
    cid,
    filePath,
    expectedCid,
    state: QUEUE_STATES.PENDING,
    addedAt: Date.now(),
    attempts: 0,
    maxAttempts: 5
  };
  
  uploadQueue.push(queueItem);
  queueEvents.emit('itemAdded', queueItem);
  processQueue();
  
  return queueItem;
}

// Process the upload queue
async function processQueue() {
  // Check if we can process more items
  if (uploadInProgress.size >= MAX_CONCURRENT_UPLOADS) {
    return;
  }
  
  // Find next pending item
  const pendingItem = uploadQueue.find(item => 
    item.state === QUEUE_STATES.PENDING && 
    !uploadInProgress.has(item.cid)
  );
  
  if (!pendingItem) {
    return;
  }
  
  // Mark as in progress
  uploadInProgress.set(pendingItem.cid, pendingItem);
  pendingItem.state = QUEUE_STATES.VERIFYING;
  
  try {
    // Verify CID before uploading
    const fileBuffer = await fs.readFile(pendingItem.filePath);
    const calculatedCid = await IpfsOnlyHash.of(fileBuffer);
    
    if (calculatedCid !== pendingItem.expectedCid) {
      throw new Error(`CID mismatch: expected ${pendingItem.expectedCid}, got ${calculatedCid}`);
    }
    
    // CID verified, now upload to IPFS
    pendingItem.state = QUEUE_STATES.UPLOADING;
    await uploadToIPFS(pendingItem, fileBuffer);
    
    // Mark as completed
    pendingItem.state = QUEUE_STATES.COMPLETED;
    queueEvents.emit('uploadCompleted', pendingItem);
    
  } catch (error) {
    pendingItem.attempts++;
    console.error(`Upload failed for ${pendingItem.cid}:`, error.message);
    
    if (pendingItem.attempts >= pendingItem.maxAttempts) {
      pendingItem.state = QUEUE_STATES.FAILED;
      pendingItem.error = error.message;
      queueEvents.emit('uploadFailed', pendingItem);
    } else {
      // Retry after delay
      pendingItem.state = QUEUE_STATES.PENDING;
      setTimeout(() => processQueue(), Math.min(1000 * Math.pow(2, pendingItem.attempts), 30000));
    }
  } finally {
    uploadInProgress.delete(pendingItem.cid);
    // Process next item
    setImmediate(processQueue);
  }
}

// Upload file to IPFS with retry logic
async function uploadToIPFS(queueItem, fileBuffer) {
  // Get ipfs instance from centralized module
  const { getIPFSInstance } = require('./ipfsDirectClient');
  const ipfs = getIPFSInstance();
  
  if (!ipfs) {
    throw new Error('IPFS client not initialized');
  }
  
  try {
    // Upload file using new API
    const result = await ipfs.add(fileBuffer);
    
    // Verify the uploaded CID matches
    if (result.cid.toString() !== queueItem.expectedCid) {
      throw new Error(`IPFS returned different CID: ${result.cid.toString()}`);
    }
    
    // Pin the file
    try {
      await ipfs.pin.add(queueItem.expectedCid);
    } catch (pinErr) {
      console.error(`Failed to pin ${queueItem.expectedCid}:`, pinErr);
      // Don't fail the upload if pinning fails
    }
    
    queueItem.ipfsResult = {
      hash: result.cid.toString(),
      path: result.path,
      size: result.size
    };
    
    return queueItem.ipfsResult;
  } catch (err) {
    throw err;
  }
}

// Get queue status
function getQueueStatus() {
  const status = {
    total: uploadQueue.length,
    pending: uploadQueue.filter(item => item.state === QUEUE_STATES.PENDING).length,
    verifying: uploadQueue.filter(item => item.state === QUEUE_STATES.VERIFYING).length,
    uploading: uploadQueue.filter(item => item.state === QUEUE_STATES.UPLOADING).length,
    completed: uploadQueue.filter(item => item.state === QUEUE_STATES.COMPLETED).length,
    failed: uploadQueue.filter(item => item.state === QUEUE_STATES.FAILED).length,
    inProgress: uploadInProgress.size
  };
  
  return status;
}

// Get items for a specific contract
function getContractItems(contractId) {
  return uploadQueue.filter(item => item.contractId === contractId);
}

// Clean up completed items older than specified age
function cleanupQueue(maxAgeMs = 3600000) { // Default 1 hour
  const cutoffTime = Date.now() - maxAgeMs;
  const itemsToRemove = uploadQueue.filter(item => 
    (item.state === QUEUE_STATES.COMPLETED || item.state === QUEUE_STATES.FAILED) &&
    item.addedAt < cutoffTime
  );
  
  itemsToRemove.forEach(item => {
    const index = uploadQueue.indexOf(item);
    if (index > -1) {
      uploadQueue.splice(index, 1);
    }
  });
  
  return itemsToRemove.length;
}

// Clean up upload files
async function cleanupUploadFiles(daysOld = 7) {
  const uploadsDir = './uploads';
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  let cleanedCount = 0;
  
  try {
    const files = await fs.readdir(uploadsDir);
    
    for (const file of files) {
      const filePath = `${uploadsDir}/${file}`;
      const stats = await fs.stat(filePath);
      
      // Check if file is old enough and not in active queue
      if (stats.mtimeMs < cutoffTime) {
        const cid = file.split('-')[0];
        const activeItem = uploadQueue.find(item => 
          item.cid === cid && 
          (item.state === QUEUE_STATES.PENDING || 
           item.state === QUEUE_STATES.VERIFYING || 
           item.state === QUEUE_STATES.UPLOADING)
        );
        
        if (!activeItem) {
          await fs.remove(filePath);
          cleanedCount++;
        }
      }
    }
  } catch (error) {
    console.error('Error cleaning upload files:', error);
  }
  
  return cleanedCount;
}

// Verify CID without uploading
async function verifyCID(filePath, expectedCid) {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const calculatedCid = await IpfsOnlyHash.of(fileBuffer);
    return calculatedCid === expectedCid;
  } catch (error) {
    console.error('Error verifying CID:', error);
    return false;
  }
}

// Start periodic cleanup
setInterval(() => {
  const removedFromQueue = cleanupQueue();
  if (removedFromQueue > 0) {
    console.log(`Cleaned up ${removedFromQueue} completed/failed items from queue`);
  }
}, 300000); // Every 5 minutes

// Daily cleanup of old upload files
setInterval(async () => {
  const cleanedFiles = await cleanupUploadFiles();
  if (cleanedFiles > 0) {
    console.log(`Cleaned up ${cleanedFiles} old upload files`);
  }
}, 86400000); // Every 24 hours

module.exports = {
  addToQueue,
  processQueue,
  getQueueStatus,
  getContractItems,
  cleanupQueue,
  cleanupUploadFiles,
  verifyCID,
  queueEvents,
  QUEUE_STATES
};