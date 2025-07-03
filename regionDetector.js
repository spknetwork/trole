// Geographic Region Auto-Detection Module
const axios = require('axios');
const dns = require('dns').promises;
const os = require('os');

class RegionDetector {
    constructor() {
        // Free IP geolocation services
        this.geoServices = [
            {
                name: 'ipapi',
                url: 'http://ip-api.com/json/',
                parseResponse: (data) => {
                    if (data.status === 'success') {
                        return {
                            country: data.countryCode?.toLowerCase(),
                            region: data.region?.toLowerCase(),
                            city: data.city?.toLowerCase(),
                            timezone: data.timezone,
                            lat: data.lat,
                            lon: data.lon
                        };
                    }
                    return null;
                }
            },
            {
                name: 'ipinfo',
                url: 'https://ipinfo.io/json',
                parseResponse: (data) => {
                    if (data.country) {
                        return {
                            country: data.country?.toLowerCase(),
                            region: data.region?.toLowerCase(),
                            city: data.city?.toLowerCase(),
                            timezone: data.timezone,
                            lat: parseFloat(data.loc?.split(',')[0]),
                            lon: parseFloat(data.loc?.split(',')[1])
                        };
                    }
                    return null;
                }
            },
            {
                name: 'geojs',
                url: 'https://get.geojs.io/v1/ip/geo.json',
                parseResponse: (data) => {
                    if (data.country_code) {
                        return {
                            country: data.country_code?.toLowerCase(),
                            region: data.region?.toLowerCase(),
                            city: data.city?.toLowerCase(),
                            timezone: data.timezone,
                            lat: parseFloat(data.latitude),
                            lon: parseFloat(data.longitude)
                        };
                    }
                    return null;
                }
            }
        ];

        // Region mapping based on country codes and known cloud regions
        this.regionMappings = {
            // North America
            'us': 'us',
            'ca': 'ca',
            'mx': 'mx',
            
            // South America
            'br': 'br',
            'ar': 'ar',
            'cl': 'cl',
            'co': 'co',
            've': 've',
            'pe': 'pe',
            
            // Europe
            'gb': 'eu-west',
            'uk': 'eu-west',
            'de': 'eu-central',
            'fr': 'eu-west',
            'nl': 'eu-west',
            'es': 'eu-west',
            'it': 'eu-central',
            'se': 'eu-north',
            'pl': 'eu-central',
            'ie': 'eu-west',
            'be': 'eu-west',
            'ch': 'eu-central',
            'at': 'eu-central',
            
            // Asia
            'jp': 'asia-northeast',
            'cn': 'asia-east',
            'kr': 'asia-northeast',
            'sg': 'asia-southeast',
            'in': 'asia-south',
            'hk': 'asia-east',
            'tw': 'asia-east',
            'au': 'asia-pacific',
            'nz': 'asia-pacific',
            'id': 'asia-southeast',
            'my': 'asia-southeast',
            'th': 'asia-southeast',
            'vn': 'asia-southeast',
            'ph': 'asia-southeast',
            
            // Middle East & Africa
            'za': 'africa-south',
            'eg': 'africa-north',
            'ng': 'africa-west',
            'ke': 'africa-east',
            'ae': 'middle-east',
            'sa': 'middle-east',
            'il': 'middle-east',
            'tr': 'middle-east'
        };
    }

    // Main method to detect region
    async detectRegion() {
        console.log('Starting automatic region detection...');
        
        // Try multiple detection methods
        let region = null;
        
        // Method 1: Try IP geolocation services
        region = await this.detectViaGeolocation();
        if (region) {
            console.log(`Region detected via geolocation: ${region}`);
            return region;
        }
        
        // Method 2: Try AWS metadata service (for EC2 instances)
        region = await this.detectViaAwsMetadata();
        if (region) {
            console.log(`Region detected via AWS metadata: ${region}`);
            return region;
        }
        
        // Method 3: Try DNS-based detection
        region = await this.detectViaDns();
        if (region) {
            console.log(`Region detected via DNS: ${region}`);
            return region;
        }
        
        // Method 4: Try latency-based detection
        region = await this.detectViaLatency();
        if (region) {
            console.log(`Region detected via latency analysis: ${region}`);
            return region;
        }
        
        console.log('Could not auto-detect region, defaulting to "unknown"');
        return 'unknown';
    }

    // Detect region using IP geolocation services
    async detectViaGeolocation() {
        for (const service of this.geoServices) {
            try {
                const response = await axios.get(service.url, {
                    timeout: 5000,
                    validateStatus: () => true
                });
                
                if (response.status === 200) {
                    const geoData = service.parseResponse(response.data);
                    
                    if (geoData && geoData.country) {
                        // Map country to region
                        const region = this.regionMappings[geoData.country];
                        if (region) {
                            // Store additional geo data for future use
                            this.geoData = geoData;
                            return region;
                        }
                        
                        // If no specific mapping, use continent-based fallback
                        return this.getRegionFromCoordinates(geoData.lat, geoData.lon) || geoData.country;
                    }
                }
            } catch (error) {
                console.log(`Failed to get location from ${service.name}: ${error.message}`);
            }
        }
        
        return null;
    }

    // Detect if running on AWS EC2 and get region
    async detectViaAwsMetadata() {
        try {
            // AWS EC2 metadata service
            const response = await axios.get('http://169.254.169.254/latest/meta-data/placement/region', {
                timeout: 1000 // Short timeout as this will fail on non-EC2
            });
            
            if (response.status === 200 && response.data) {
                return response.data;
            }
        } catch (error) {
            // Expected to fail on non-EC2 instances
        }
        
        return null;
    }

    // Try to detect region via DNS lookup patterns
    async detectViaDns() {
        try {
            const hostname = os.hostname();
            
            // Common cloud provider patterns in hostnames
            const patterns = [
                { regex: /\.([a-z]{2}-[a-z]+-\d+)\./, group: 1 }, // AWS format
                { regex: /\.([a-z]+-[a-z]+)\./, group: 1 }, // General region format
                { regex: /-([a-z]{2}\d?)\./, group: 1 }, // Country code format
            ];
            
            for (const pattern of patterns) {
                const match = hostname.match(pattern.regex);
                if (match && match[pattern.group]) {
                    const possibleRegion = match[pattern.group];
                    // Validate it looks like a region
                    if (possibleRegion.length >= 2 && possibleRegion.length <= 20) {
                        return possibleRegion;
                    }
                }
            }
        } catch (error) {
            console.log(`DNS detection failed: ${error.message}`);
        }
        
        return null;
    }

    // Detect region based on latency to known endpoints
    async detectViaLatency() {
        const testEndpoints = [
            { region: 'us-east', url: 'https://s3.amazonaws.com/ping' },
            { region: 'us-west', url: 'https://s3-us-west-2.amazonaws.com/ping' },
            { region: 'eu-west', url: 'https://s3-eu-west-1.amazonaws.com/ping' },
            { region: 'eu-central', url: 'https://s3.eu-central-1.amazonaws.com/ping' },
            { region: 'asia-northeast', url: 'https://s3-ap-northeast-1.amazonaws.com/ping' },
            { region: 'asia-southeast', url: 'https://s3-ap-southeast-1.amazonaws.com/ping' },
            { region: 'asia-south', url: 'https://s3.ap-south-1.amazonaws.com/ping' }
        ];
        
        const latencies = [];
        
        for (const endpoint of testEndpoints) {
            try {
                const start = Date.now();
                await axios.head(endpoint.url, {
                    timeout: 5000,
                    validateStatus: () => true
                });
                const latency = Date.now() - start;
                
                latencies.push({
                    region: endpoint.region,
                    latency: latency
                });
            } catch (error) {
                // Skip failed endpoints
            }
        }
        
        if (latencies.length > 0) {
            // Sort by latency and return the closest region
            latencies.sort((a, b) => a.latency - b.latency);
            return latencies[0].region;
        }
        
        return null;
    }

    // Helper to determine region from coordinates
    getRegionFromCoordinates(lat, lon) {
        if (!lat || !lon) return null;
        
        // Rough geographic boundaries
        if (lat >= 25 && lat <= 50 && lon >= -130 && lon <= -60) return 'us';
        if (lat >= 50 && lat <= 70 && lon >= -130 && lon <= -50) return 'ca';
        if (lat >= 35 && lat <= 70 && lon >= -10 && lon <= 40) return 'eu-west';
        if (lat >= -40 && lat <= 35 && lon >= -20 && lon <= 50) return 'africa';
        if (lat >= 20 && lat <= 50 && lon >= 60 && lon <= 150) return 'asia-east';
        if (lat >= -50 && lat <= 20 && lon >= 60 && lon <= 150) return 'asia-southeast';
        if (lat >= -50 && lat <= -10 && lon >= -80 && lon <= -30) return 'south-america';
        if (lat >= -50 && lat <= -10 && lon >= 110 && lon <= 160) return 'asia-pacific';
        
        return null;
    }

    // Get stored geo data
    getGeoData() {
        return this.geoData || null;
    }
}

module.exports = RegionDetector;