// IPFS Proxy System
const axios = require('axios');
const cron = require('node-cron');
const config = require('./config');
const { Hash } = require('ipfs-only-hash');
const { HealthScoreEncoder, LatencyStatistics } = require('./healthScore');
const GeoCorrection = require('./geoCorrection');
const RegionDetector = require('./regionDetector');

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
        
        // Peer health monitoring
        this.peerHealthMap = new Map(); // peerNode -> { lastCheck, latencies, healthScore }
        this.healthEncoder = new HealthScoreEncoder();
        this.latencyStats = new LatencyStatistics(config.HEALTH_WINDOW_SIZE || 100);
        this.geoLatencyStats = new LatencyStatistics(config.HEALTH_WINDOW_SIZE || 100);
        this.geoCorrection = new GeoCorrection();
        this.peerTestInterval = config.PEER_TEST_INTERVAL || 300000; // 5 minutes
        this.minTestsForScore = config.MIN_TESTS_FOR_SCORE || 10;
        this.lastPeerFetch = 0;
        this.peerList = [];
        this.myRegion = config.NODE_REGION || 'unknown';
        
        // Initialize and start monitoring
        this.initializeHealthCheck();
        this.initializeRegionDetection();
        this.startHealthMonitoring();
        this.startPeerHealthMonitoring();
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

    async initializeRegionDetection() {
        // Auto-detect region if not manually configured
        if (this.myRegion === 'unknown' || !this.myRegion) {
            try {
                const detector = new RegionDetector();
                const detectedRegion = await detector.detectRegion();
                
                if (detectedRegion && detectedRegion !== 'unknown') {
                    this.myRegion = detectedRegion;
                    console.log(`Auto-detected node region: ${this.myRegion}`);
                    
                    // Store geo data if available
                    const geoData = detector.getGeoData();
                    if (geoData) {
                        this.geoData = geoData;
                        console.log(`Node location: ${geoData.city || 'Unknown city'}, ${geoData.country || 'Unknown country'}`);
                    }
                } else {
                    console.log('Could not auto-detect region, using default: unknown');
                }
            } catch (error) {
                console.error('Error during region detection:', error.message);
            }
        } else {
            console.log(`Using configured node region: ${this.myRegion}`);
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

    async fetchPeerNodes() {
        try {
            // Only fetch peer list if it's been more than 10 minutes
            if (Date.now() - this.lastPeerFetch < 600000) {
                return this.peerList;
            }

            const response = await axios.get(`${config.SPK_API}/api/nodes`, {
                timeout: 10000
            });
            
            const nodes = response.data?.nodes || [];
            this.peerList = nodes.filter(node => {
                // Filter out self and ensure node has valid gateway URL
                return node.account !== config.account && node.gateway;
            }).map(node => ({
                account: node.account,
                gateway: node.gateway,
                region: node.region || 'unknown'
            }));
            
            this.lastPeerFetch = Date.now();
            console.log(`Fetched ${this.peerList.length} peer nodes for health monitoring`);
            
            return this.peerList;
        } catch (error) {
            console.error('Error fetching peer nodes:', error.message);
            return this.peerList; // Return cached list on error
        }
    }

    async testPeerHealth(peer) {
        const startTime = Date.now();
        
        try {
            // Make request with special headers to prevent redirection
            const response = await axios.get(`${peer.gateway}/ipfs/${this.healthCheckCid}`, {
                timeout: this.healthCheckTimeout,
                headers: {
                    'X-Health-Check': 'true',
                    'X-No-Redirect': 'true',
                    'X-From-Node': config.account || 'unknown'
                },
                validateStatus: (status) => status < 500
            });
            
            const latency = Date.now() - startTime;
            
            // Add measurement to statistics
            this.latencyStats.addMeasurement(peer.account, latency);
            
            // Calculate geo-corrected latency (placeholder for now)
            const geoLatency = this.calculateGeoCorrectedLatency(latency, peer.region);
            this.geoLatencyStats.addMeasurement(peer.account, geoLatency);
            
            // Update peer health data
            if (!this.peerHealthMap.has(peer.account)) {
                this.peerHealthMap.set(peer.account, {
                    lastCheck: Date.now(),
                    healthScore: null,
                    failures: 0
                });
            }
            
            const peerHealth = this.peerHealthMap.get(peer.account);
            peerHealth.lastCheck = Date.now();
            peerHealth.failures = 0;
            
            // Calculate health score if we have enough data
            const stats = this.latencyStats.getStatistics(peer.account);
            if (stats && stats.count >= this.minTestsForScore) {
                const rawZScore = this.latencyStats.calculateZScore(peer.account, latency);
                const geoZScore = this.geoLatencyStats.calculateZScore(peer.account, geoLatency);
                
                peerHealth.healthScore = this.healthEncoder.encodeHealthScore(rawZScore, geoZScore);
            }
            
            return { success: true, latency, peer: peer.account };
            
        } catch (error) {
            // Track failures
            if (!this.peerHealthMap.has(peer.account)) {
                this.peerHealthMap.set(peer.account, {
                    lastCheck: Date.now(),
                    healthScore: null,
                    failures: 1
                });
            } else {
                const peerHealth = this.peerHealthMap.get(peer.account);
                peerHealth.failures = (peerHealth.failures || 0) + 1;
                peerHealth.lastCheck = Date.now();
            }
            
            return { success: false, error: error.message, peer: peer.account };
        }
    }

    calculateGeoCorrectedLatency(latency, peerRegion) {
        // Use the geo-correction module to adjust latency based on distance
        return this.geoCorrection.calculateGeoCorrectedLatency(
            latency,
            this.myRegion,
            peerRegion
        );
    }

    startPeerHealthMonitoring() {
        // Run peer health checks periodically
        const intervalMinutes = Math.floor(this.peerTestInterval / 60000);
        const cronSchedule = `*/${intervalMinutes} * * * *`;
        
        cron.schedule(cronSchedule, async () => {
            const peers = await this.fetchPeerNodes();
            
            if (peers.length === 0) {
                console.log('No peer nodes available for health monitoring');
                return;
            }
            
            console.log(`Running peer health checks for ${peers.length} nodes`);
            
            // Test peers in batches to avoid overwhelming the network
            const batchSize = 5;
            for (let i = 0; i < peers.length; i += batchSize) {
                const batch = peers.slice(i, i + batchSize);
                const tests = batch.map(peer => this.testPeerHealth(peer));
                
                const results = await Promise.allSettled(tests);
                
                // Log results
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && result.value.success) {
                        console.log(`Peer health check ${result.value.peer}: ${result.value.latency}ms`);
                    } else if (result.status === 'fulfilled' && !result.value.success) {
                        console.log(`Peer health check ${result.value.peer} failed: ${result.value.error}`);
                    }
                });
                
                // Small delay between batches
                if (i + batchSize < peers.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        });
        
        // Also run an initial check after 30 seconds
        setTimeout(() => {
            this.fetchPeerNodes().then(peers => {
                if (peers.length > 0) {
                    const randomPeers = peers.slice(0, Math.min(3, peers.length));
                    randomPeers.forEach(peer => this.testPeerHealth(peer));
                }
            });
        }, 30000);
    }

    getPeerHealthScore(peerAccount) {
        const peerHealth = this.peerHealthMap.get(peerAccount);
        
        if (!peerHealth || !peerHealth.healthScore) {
            return null;
        }
        
        return peerHealth.healthScore;
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

// Node health endpoint
// '/node-health/:targetNode'
const nodeHealthRoute = async (req, res) => {
    const { targetNode } = req.params;
    
    // Only respond to health check requests
    if (!req.headers['x-health-check'] || req.headers['x-health-check'] !== 'true') {
        return res.status(403).json({
            error: 'This endpoint only responds to health check requests'
        });
    }
    
    // Get health score for the target node
    const healthScore = ipfsProxy.getPeerHealthScore(targetNode);
    
    if (!healthScore) {
        // Return empty response if no data available
        return res.send('');
    }
    
    // Return the 2-character health score
    res.send(healthScore);
};

// Peer health statistics endpoint
// '/peer-health-stats'
const peerHealthStatsRoute = async (req, res) => {
    const stats = {
        timestamp: new Date().toISOString(),
        encoder: {
            normalChar: ipfsProxy.healthEncoder.getCharAtPosition(32),
            normalPosition: 32,
            zScoreStep: 0.1,
            description: 'Each character represents 0.1 standard deviations'
        },
        peers: []
    };
    
    // Compile statistics for each peer
    for (const [peerAccount, peerHealth] of ipfsProxy.peerHealthMap.entries()) {
        const rawStats = ipfsProxy.latencyStats.getStatistics(peerAccount);
        const geoStats = ipfsProxy.geoLatencyStats.getStatistics(peerAccount);
        
        const peerInfo = {
            account: peerAccount,
            healthScore: peerHealth.healthScore,
            lastCheck: new Date(peerHealth.lastCheck).toISOString(),
            failures: peerHealth.failures || 0,
            measurements: rawStats ? rawStats.count : 0
        };
        
        // Decode health score if available
        if (peerHealth.healthScore) {
            try {
                const decoded = ipfsProxy.healthEncoder.decodeHealthScore(peerHealth.healthScore);
                peerInfo.decodedScore = {
                    raw: {
                        zScore: decoded.raw.toFixed(2),
                        description: ipfsProxy.healthEncoder.describeZScore(decoded.raw)
                    },
                    geoCorrected: {
                        zScore: decoded.geoCorrected.toFixed(2),
                        description: ipfsProxy.healthEncoder.describeZScore(decoded.geoCorrected)
                    }
                };
            } catch (error) {
                peerInfo.decodedScore = { error: error.message };
            }
        }
        
        // Add statistics if available
        if (rawStats) {
            peerInfo.latencyStats = {
                mean: rawStats.mean.toFixed(2),
                stdDev: rawStats.stdDev.toFixed(2),
                measurements: rawStats.count
            };
        }
        
        stats.peers.push(peerInfo);
    }
    
    res.json(stats);
};

// Node region info endpoint
// '/node-region'
const nodeRegionRoute = async (req, res) => {
    const regionInfo = {
        region: ipfsProxy.myRegion,
        configured: config.NODE_REGION || null,
        autoDetected: ipfsProxy.myRegion !== config.NODE_REGION,
        geoData: ipfsProxy.geoData || null,
        timestamp: new Date().toISOString()
    };
    
    res.json(regionInfo);
};

module.exports = {
    ipfsProxyRoute,
    ipfsHealthRoute,
    ipfsStatsRoute,
    ipfsHealthPinRoute,
    nodeHealthRoute,
    peerHealthStatsRoute,
    nodeRegionRoute
}