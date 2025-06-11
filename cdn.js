// IPFS Proxy System
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config');
const { Hash } = require('ipfs-only-hash');

class IPFSProxyManager {
    constructor() {
        this.userGatewayMap = new Map(); // username -> { gateways: [urls], lastUpdated: timestamp }
        this.gatewayHealth = new Map(); // gateway_url -> { healthy: boolean, lastCheck: timestamp, failures: number, integrityChecks: object }
        this.cidList = []; // Rolling list of CIDs for integrity checks (max 100)
        this.maxCidListSize = 100;
        this.healthCheckInterval = 30000; // 30 seconds
        this.maxFailures = 3;
        this.healthCheckTimeout = 5000; // 5 seconds
        this.integrityCheckTimeout = 10000; // 10 seconds for content verification
        
        // Health check CID - empty file for consistent health monitoring
        this.healthCheckCid = 'QmNoshFoVKgH7BrJ3r1hN6G7qWFKWhz5Ap62q7DnYGs4ya';
        
        // Initialize and start monitoring
        this.initializeHealthCheck();
        this.startHealthMonitoring();
    }

    async initializeHealthCheck() {
        // Ensure our health check file is pinned to local IPFS node
        if (config.IPFS_PROXY_API) {
            try {
                await this.ensureHealthCheckFilePinned();
                console.log(`Health check file ${this.healthCheckCid} is pinned and ready`);
            } catch (error) {
                console.error(`Failed to ensure health check file is pinned:`, error.message);
            }
        }
    }

    async ensureHealthCheckFilePinned() {
        try {
            const ipfsApiUrl = `${config.ENDPROTOCOL}://${config.ENDPOINT}:${config.ENDPORT}`;
            
            // Add empty content to get the CID for health checks
            const addResponse = await axios.post(`${ipfsApiUrl}/api/v0/add`, '', {
                params: { 
                    pin: true,
                    'only-hash': false
                },
                headers: {
                    'Content-Type': 'application/octet-stream'
                },
                timeout: 10000
            });
            
            console.log(`Successfully created and pinned empty health check file ${this.healthCheckCid}`);
        } catch (error) {
            console.error(`Failed to create health check file:`, error.message);
            throw error;
        }
    }

    async fetchFileInfo(cid) {
        try {
            const response = await axios.get(`${config.SPK_API}/api/file/${cid}`, {
                timeout: 10000
            });
            return response.data?.result?.n || {};
        } catch (error) {
            console.error(`Error fetching file info for CID ${cid}:`, error.message);
            throw error;
        }
    }

    async fetchUserServices(username) {
        try {
            const response = await axios.get(`${config.SPK_API}/user_services/${username}`, {
                timeout: 10000
            });
            
            const services = response.data?.services?.IPFS || {};
            const gateways = [];
            
            for (const [ipfsId, service] of Object.entries(services)) {
                if (service.a && service.f === 1) { // Only active services
                    gateways.push(service.a);
                }
            }
            
            return gateways;
        } catch (error) {
            console.error(`Error fetching user services for ${username}:`, error.message);
            return [];
        }
    }

    async updateUserGateways(cid) {
        try {
            const fileInfo = await this.fetchFileInfo(cid);
            const users = Object.values(fileInfo);
            
            for (const username of users) {
                if (typeof username === 'string') {
                    const gateways = await this.fetchUserServices(username);
                    if (gateways.length > 0) {
                        this.userGatewayMap.set(username, {
                            gateways,
                            lastUpdated: Date.now()
                        });
                        
                        // Initialize health status for new gateways
                        gateways.forEach(gateway => {
                            if (!this.gatewayHealth.has(gateway)) {
                                this.gatewayHealth.set(gateway, {
                                    healthy: true,
                                    lastCheck: 0,
                                    failures: 0,
                                    integrityChecks: {
                                        total: 0,
                                        passed: 0,
                                        failed: 0,
                                        lastIntegrityCheck: 0
                                    }
                                });
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error updating user gateways for CID ${cid}:`, error.message);
        }
    }

    addCidToList(cid) {
        // Add CID to rolling list, maintaining max size
        if (!this.cidList.includes(cid)) {
            this.cidList.push(cid);
            if (this.cidList.length > this.maxCidListSize) {
                this.cidList.shift(); // Remove oldest CID
            }
        }
    }

    async checkContentIntegrity(gateway, cid) {
        try {
            // Fetch content from gateway
            const response = await axios.get(`${gateway}/ipfs/${cid}`, {
                timeout: this.integrityCheckTimeout,
                responseType: 'arraybuffer'
            });
            
            // Calculate hash of received content
            const content = Buffer.from(response.data);
            const calculatedHash = await Hash.of(content);
            
            // Compare with expected CID (remove version prefix if present)
            const expectedHash = cid.startsWith('Qm') ? cid : cid.split('f')[1] || cid;
            const matches = calculatedHash === expectedHash || calculatedHash === cid;
            
            return { success: true, matches, contentSize: content.length };
        } catch (error) {
            console.error(`Content integrity check failed for ${gateway}/ipfs/${cid}:`, error.message);
            return { success: false, matches: false, error: error.message };
        }
    }

    async checkGatewayHealth(gateway) {
        const currentHealth = this.gatewayHealth.get(gateway) || { 
            failures: 0, 
            integrityChecks: { total: 0, passed: 0, failed: 0, lastIntegrityCheck: 0 }
        };
        
        try {
            // Use our dedicated health check CID instead of hardcoded one
            const response = await axios.get(`${gateway}/ipfs/${this.healthCheckCid}`, {
                timeout: this.healthCheckTimeout,
                validateStatus: (status) => status < 500 // Accept 2xx, 3xx, 4xx as healthy
            });
            
            // Perform content integrity check if we have CIDs available
            let integrityResult = null;
            if (this.cidList.length > 0) {
                // Randomly select a CID for integrity check
                const randomCid = this.cidList[Math.floor(Math.random() * this.cidList.length)];
                integrityResult = await this.checkContentIntegrity(gateway, randomCid);
                
                // Update integrity check stats
                const integrityChecks = {
                    ...currentHealth.integrityChecks,
                    total: currentHealth.integrityChecks.total + 1,
                    lastIntegrityCheck: Date.now()
                };
                
                if (integrityResult.success && integrityResult.matches) {
                    integrityChecks.passed++;
                } else {
                    integrityChecks.failed++;
                }
                
                currentHealth.integrityChecks = integrityChecks;
            }
            
            this.gatewayHealth.set(gateway, {
                ...currentHealth,
                healthy: true,
                lastCheck: Date.now(),
                failures: 0
            });
            
            return true;
        } catch (error) {
            const failures = currentHealth.failures + 1;
            
            this.gatewayHealth.set(gateway, {
                ...currentHealth,
                healthy: failures < this.maxFailures,
                lastCheck: Date.now(),
                failures
            });
            
            console.log(`Gateway ${gateway} health check failed (${failures}/${this.maxFailures}):`, error.message);
            return failures < this.maxFailures;
        }
    }

    startHealthMonitoring() {
        // Run health checks every 30 seconds
        cron.schedule('*/30 * * * * *', async () => {
            const gateways = Array.from(this.gatewayHealth.keys());
            console.log(`Running health checks for ${gateways.length} gateways`);
            
            const healthChecks = gateways.map(gateway => this.checkGatewayHealth(gateway));
            await Promise.allSettled(healthChecks);
        });
    }

    getHealthyGateways() {
        const healthy = [];
        for (const [gateway, health] of this.gatewayHealth.entries()) {
            if (health.healthy) {
                healthy.push(gateway);
            }
        }
        return healthy;
    }

    getUserGateways(cid) {
        const allGateways = [];
        
        // Collect all gateways from users associated with this CID
        for (const [username, data] of this.userGatewayMap.entries()) {
            allGateways.push(...data.gateways);
        }
        
        // Filter for healthy gateways
        const healthyGateways = allGateways.filter(gateway => {
            const health = this.gatewayHealth.get(gateway);
            return health && health.healthy;
        });
        
        return healthyGateways;
    }

    async proxyRequest(req, res, cid) {
        try {
            // Add CID to rolling list for integrity checks and network tracking
            this.addCidToList(cid);
            
            // Step 1: Check if this is our health check CID - always serve locally
            if (cid === this.healthCheckCid && config.IPFS_PROXY_API) {
                const selectedGateway = config.IPFS_PROXY_API;
                const proxyUrl = `${config.IPFS_PROXY_API}/ipfs/${cid}`;
                console.log(`Serving health check CID ${cid} locally: ${selectedGateway}`);
                
                const response = await axios.get(proxyUrl, {
                    timeout: 30000,
                    responseType: 'stream'
                });
                
                res.set({
                    'Content-Type': response.headers['content-type'] || 'application/octet-stream',
                    'Content-Length': response.headers['content-length'],
                    'Cache-Control': 'public, max-age=31536000',
                    'ETag': response.headers['etag']
                });
                
                response.data.pipe(res);
                return;
            }

            // Step 2: Check if this request is already routed to us via header
            const targetAccount = req.headers['x-for'];
            const isRoutedToUs = targetAccount === config.account;
            
            let proxyUrl;
            let selectedGateway;
            let targetClaimant = null;
            
            if (isRoutedToUs && config.IPFS_PROXY_API) {
                // Serve from local node - this request is routed to us
                selectedGateway = config.IPFS_PROXY_API;
                proxyUrl = `${config.IPFS_PROXY_API}/ipfs/${cid}`;
                console.log(`Serving CID ${cid} locally (routed via X-For header): ${selectedGateway}`);
            } else {
                // Step 2: Run resource search and proxy to claimant node
                const fileInfo = await this.fetchFileInfo(cid);
                const users = Object.values(fileInfo);
                
                // Find a claimant account for this resource
                const claimantAccount = users.find(username => 
                    typeof username === 'string' && username !== config.account
                );
                
                if (claimantAccount) {
                    targetClaimant = claimantAccount;
                    await this.updateUserGateways(cid);
                    
                    // Get healthy gateways from claimant nodes for this CID
                    let gateways = this.getUserGateways(cid);
                    
                    // Fallback to any healthy gateway if no CID-specific claimants available
                    if (gateways.length === 0) {
                        gateways = this.getHealthyGateways();
                    }
                    
                    if (gateways.length === 0) {
                        return res.status(503).json({ 
                            error: 'No healthy IPFS gateways available',
                            cid 
                        });
                    }
                    
                    // Select claimant gateway (round-robin)
                    const gatewayIndex = Math.floor(Math.random() * gateways.length);
                    selectedGateway = gateways[gatewayIndex];
                    proxyUrl = `${selectedGateway}/ipfs/${cid}`;
                    
                    console.log(`Proxying CID ${cid} to claimant ${targetClaimant} via gateway: ${selectedGateway}`);
                } else {
                    // No specific claimant found, use any healthy gateway
                    const gateways = this.getHealthyGateways();
                    
                    if (gateways.length === 0) {
                        return res.status(503).json({ 
                            error: 'No healthy IPFS gateways available',
                            cid 
                        });
                    }
                    
                    const gatewayIndex = Math.floor(Math.random() * gateways.length);
                    selectedGateway = gateways[gatewayIndex];
                    proxyUrl = `${selectedGateway}/ipfs/${cid}`;
                    
                    console.log(`Proxying CID ${cid} to fallback gateway: ${selectedGateway}`);
                }
            }
            
            // Execute the proxy request with routing headers
            const requestHeaders = {
                'User-Agent': `TROLE-IPFS-Proxy/${config.account || 'unknown'}`
            };
            
            // Add routing header if we identified a target claimant
            if (targetClaimant) {
                requestHeaders['X-For'] = targetClaimant;
            }
            
            const response = await axios.get(proxyUrl, {
                timeout: 30000,
                responseType: 'stream',
                headers: requestHeaders
            });
            
            // Forward headers
            res.set({
                'Content-Type': response.headers['content-type'] || 'application/octet-stream',
                'Content-Length': response.headers['content-length'],
                'Cache-Control': response.headers['cache-control'] || 'public, max-age=31536000',
                'ETag': response.headers['etag']
            });
            
            // Stream the response
            response.data.pipe(res);
            
        } catch (error) {
            console.error(`Error proxying CID ${cid}:`, error.message);
            
            if (error.response) {
                res.status(error.response.status).json({
                    error: 'Gateway error',
                    status: error.response.status,
                    cid
                });
            } else {
                res.status(500).json({
                    error: 'Internal server error',
                    message: error.message,
                    cid
                });
            }
        }
    }
}

// Create global instance
const ipfsProxy = new IPFSProxyManager();

// IPFS Proxy Route
// '/ipfs/:cid', 
const ipfsProxyRoute = async (req, res) => {
    const { cid } = req.params;
    
    // Basic CID validation
    if (!cid || cid.length < 10) {
        return res.status(400).json({
            error: 'Invalid CID provided',
            cid
        });
    }
    
    await ipfsProxy.proxyRequest(req, res, cid);
}

// Health status endpoint
// '/ipfs-health'
const ipfsHealthRoute = async (req, res) => {
    const gateways = [];
    let totalIntegrityChecks = 0;
    let totalIntegrityPassed = 0;
    
    for (const [gateway, health] of ipfsProxy.gatewayHealth.entries()) {
        totalIntegrityChecks += health.integrityChecks?.total || 0;
        totalIntegrityPassed += health.integrityChecks?.passed || 0;
        
        gateways.push({
            gateway,
            healthy: health.healthy,
            lastCheck: new Date(health.lastCheck).toISOString(),
            failures: health.failures,
            integrityChecks: {
                total: health.integrityChecks?.total || 0,
                passed: health.integrityChecks?.passed || 0,
                failed: health.integrityChecks?.failed || 0,
                lastIntegrityCheck: health.integrityChecks?.lastIntegrityCheck ? 
                    new Date(health.integrityChecks.lastIntegrityCheck).toISOString() : null,
                passRate: health.integrityChecks?.total > 0 ? 
                    ((health.integrityChecks.passed / health.integrityChecks.total) * 100).toFixed(2) + '%' : 'N/A'
            }
        });
    }
    
    res.json({
        totalGateways: gateways.length,
        healthyGateways: gateways.filter(g => g.healthy).length,
        cidListSize: ipfsProxy.cidList.length,
        healthCheckCid: ipfsProxy.healthCheckCid,
        overallIntegrityStats: {
            totalChecks: totalIntegrityChecks,
            totalPassed: totalIntegrityPassed,
            totalFailed: totalIntegrityChecks - totalIntegrityPassed,
            overallPassRate: totalIntegrityChecks > 0 ? 
                ((totalIntegrityPassed / totalIntegrityChecks) * 100).toFixed(2) + '%' : 'N/A'
        },
        gateways
    });
}

// Statistics endpoint for rewards reporting
// '/ipfs-stats'
const ipfsStatsRoute = async (req, res) => {
    const stats = {
        timestamp: new Date().toISOString(),
        cidList: {
            size: ipfsProxy.cidList.length,
            maxSize: ipfsProxy.maxCidListSize,
            cids: ipfsProxy.cidList.slice(-10) // Last 10 CIDs for reference
        },
        gatewayHealth: {}
    };
    
    // Compile detailed statistics for each gateway
    for (const [gateway, health] of ipfsProxy.gatewayHealth.entries()) {
        const integrityChecks = health.integrityChecks || { total: 0, passed: 0, failed: 0 };
        
        stats.gatewayHealth[gateway] = {
            healthy: health.healthy,
            uptime: health.failures === 0 ? 100 : 
                Math.max(0, ((health.lastCheck - (health.failures * 30000)) / health.lastCheck) * 100).toFixed(2),
            connectivityChecks: {
                failures: health.failures,
                lastCheck: health.lastCheck
            },
            integrityChecks: {
                total: integrityChecks.total,
                passed: integrityChecks.passed,
                failed: integrityChecks.failed,
                passRate: integrityChecks.total > 0 ? 
                    ((integrityChecks.passed / integrityChecks.total) * 100).toFixed(2) : 0,
                lastCheck: integrityChecks.lastIntegrityCheck
            },
            rewardScore: calculateRewardScore(health)
        };
    }
    
    res.json(stats);
};

// Helper function to calculate reward score based on health metrics
function calculateRewardScore(health) {
    const integrityChecks = health.integrityChecks || { total: 0, passed: 0 };
    
    // Base score for being healthy
    let score = health.healthy ? 50 : 0;
    
    // Bonus for low failures
    score += Math.max(0, 25 - (health.failures * 5));
    
    // Bonus for integrity check pass rate
    if (integrityChecks.total > 0) {
        const passRate = integrityChecks.passed / integrityChecks.total;
        score += passRate * 25;
    }
    
    return Math.min(100, Math.max(0, score));
}

// Manual health check pin endpoint
// '/ipfs-health-pin'
const ipfsHealthPinRoute = async (req, res) => {
    try {
        await ipfsProxy.ensureHealthCheckFilePinned();
        res.json({
            success: true,
            message: `Health check file ${ipfsProxy.healthCheckCid} pinning operation completed`,
            healthCheckCid: ipfsProxy.healthCheckCid
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to pin health check file',
            error: error.message,
            healthCheckCid: ipfsProxy.healthCheckCid
        });
    }
};

module.exports = {
    ipfsProxyRoute,
    ipfsHealthRoute,
    ipfsStatsRoute,
    ipfsHealthPinRoute
}