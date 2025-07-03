// Geographic Latency Correction Module
// Adjusts latency measurements based on expected geographic distances

class GeoCorrection {
    constructor() {
        // Expected baseline latencies between regions (in ms)
        // These are rough estimates for typical internet routing
        this.regionLatencies = {
            'same': 5,          // Same datacenter/city
            'local': 20,        // Same country/region
            'continental': 50,  // Same continent
            'intercontinental': 150  // Different continents
        };
        
        // Region groupings for distance estimation
        this.continents = {
            'north-america': ['us', 'ca', 'mx', 'us-east', 'us-west', 'us-central'],
            'south-america': ['br', 'ar', 'cl', 'co', 've', 'pe'],
            'europe': ['gb', 'de', 'fr', 'nl', 'es', 'it', 'se', 'pl', 'eu-west', 'eu-central'],
            'asia': ['jp', 'cn', 'kr', 'sg', 'in', 'hk', 'tw', 'asia-pacific'],
            'africa': ['za', 'eg', 'ng', 'ke'],
            'oceania': ['au', 'nz']
        };
        
        // Speed of light in fiber (approximately 200,000 km/s)
        // Minimum theoretical latency is distance / speed * 2 (round trip)
        this.fiberSpeedKmPerMs = 200; // km/ms
    }
    
    // Estimate distance category between two regions
    estimateDistanceCategory(region1, region2) {
        if (!region1 || !region2 || region1 === 'unknown' || region2 === 'unknown') {
            return 'unknown';
        }
        
        // Normalize region names
        const r1 = region1.toLowerCase();
        const r2 = region2.toLowerCase();
        
        // Same region
        if (r1 === r2) {
            return 'same';
        }
        
        // Find continents
        const continent1 = this.findContinent(r1);
        const continent2 = this.findContinent(r2);
        
        if (continent1 === continent2) {
            // Check if they're in the same country (for multi-region countries)
            if (this.isSameCountry(r1, r2)) {
                return 'local';
            }
            return 'continental';
        }
        
        return 'intercontinental';
    }
    
    findContinent(region) {
        for (const [continent, regions] of Object.entries(this.continents)) {
            if (regions.some(r => region.includes(r) || r.includes(region))) {
                return continent;
            }
        }
        return 'unknown';
    }
    
    isSameCountry(region1, region2) {
        // Check common country prefixes
        const countryPrefixes = ['us-', 'eu-', 'asia-', 'ca-', 'au-'];
        
        for (const prefix of countryPrefixes) {
            if (region1.startsWith(prefix) && region2.startsWith(prefix)) {
                return true;
            }
        }
        
        return false;
    }
    
    // Get expected baseline latency for a distance category
    getExpectedLatency(distanceCategory) {
        return this.regionLatencies[distanceCategory] || this.regionLatencies['intercontinental'];
    }
    
    // Calculate geo-corrected latency
    calculateGeoCorrectedLatency(actualLatency, sourceRegion, targetRegion) {
        const distanceCategory = this.estimateDistanceCategory(sourceRegion, targetRegion);
        
        if (distanceCategory === 'unknown') {
            // Can't correct if we don't know the regions
            return actualLatency;
        }
        
        const expectedBaseline = this.getExpectedLatency(distanceCategory);
        
        // Calculate correction factor
        // The idea is to normalize latencies so that:
        // - Close nodes with high latency are penalized
        // - Distant nodes with reasonable latency are not penalized
        
        // Simple linear correction: corrected = actual - (expected - median)
        // Where median is a reasonable middle ground (50ms)
        const medianLatency = 50;
        const correction = expectedBaseline - medianLatency;
        
        // Apply correction but ensure we don't go below 1ms
        const correctedLatency = Math.max(1, actualLatency - correction);
        
        return correctedLatency;
    }
    
    // Get a multiplier for comparing latencies across regions
    getRegionalMultiplier(sourceRegion, targetRegion) {
        const distanceCategory = this.estimateDistanceCategory(sourceRegion, targetRegion);
        
        // Multipliers to normalize expectations
        const multipliers = {
            'same': 0.5,         // Expect very low latency
            'local': 0.7,        // Expect low latency
            'continental': 1.0,  // Normal expectations
            'intercontinental': 1.5,  // Higher latency acceptable
            'unknown': 1.0       // Default to normal
        };
        
        return multipliers[distanceCategory] || 1.0;
    }
    
    // Advanced correction using statistical approach
    calculateStatisticalGeoCorrection(actualLatency, sourceRegion, targetRegion, globalMean, globalStdDev) {
        const distanceCategory = this.estimateDistanceCategory(sourceRegion, targetRegion);
        const expectedBaseline = this.getExpectedLatency(distanceCategory);
        
        // Calculate expected z-score for this distance category
        const expectedZScore = (expectedBaseline - globalMean) / globalStdDev;
        
        // Calculate actual z-score
        const actualZScore = (actualLatency - globalMean) / globalStdDev;
        
        // Adjust z-score based on distance expectations
        const adjustedZScore = actualZScore - expectedZScore;
        
        // Convert back to latency
        const correctedLatency = globalMean + (adjustedZScore * globalStdDev);
        
        return Math.max(1, correctedLatency);
    }
}

module.exports = GeoCorrection;