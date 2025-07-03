// Health Score Encoding System for Peer-to-Peer Node Monitoring
// Uses base64 characters to represent z-scores (standard deviations from mean)

const BASE64_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+=";
const NORMAL_POSITION = 32; // 'W' character represents 0 standard deviations
const Z_SCORE_STEP = 0.1; // Each character represents 0.1 standard deviation

class HealthScoreEncoder {
    constructor() {
        this.base64Chars = BASE64_CHARS;
        this.normalPosition = NORMAL_POSITION;
        this.zScoreStep = Z_SCORE_STEP;
    }

    // Convert z-score to base64 character
    zScoreToBase64(zScore) {
        // Clamp z-score to valid range (-3.2 to +3.1)
        const clampedZ = Math.max(-3.2, Math.min(3.1, zScore));
        
        // Calculate position (0-63)
        const position = Math.round((clampedZ / this.zScoreStep) + this.normalPosition);
        
        // Ensure position is within valid range
        const finalPosition = Math.max(0, Math.min(63, position));
        
        return this.base64Chars[finalPosition];
    }

    // Convert base64 character to z-score
    base64ToZScore(char) {
        const position = this.base64Chars.indexOf(char);
        
        if (position === -1) {
            throw new Error(`Invalid base64 character: ${char}`);
        }
        
        // Calculate z-score from position
        const zScore = (position - this.normalPosition) * this.zScoreStep;
        
        return zScore;
    }

    // Encode raw and geo-corrected z-scores into 2-character string
    encodeHealthScore(rawZScore, geoCorrectedZScore) {
        const rawChar = this.zScoreToBase64(rawZScore);
        const geoChar = this.zScoreToBase64(geoCorrectedZScore);
        
        return rawChar + geoChar;
    }

    // Decode 2-character string into raw and geo-corrected z-scores
    decodeHealthScore(encodedScore) {
        if (encodedScore.length !== 2) {
            throw new Error('Health score must be exactly 2 characters');
        }
        
        const rawZScore = this.base64ToZScore(encodedScore[0]);
        const geoCorrectedZScore = this.base64ToZScore(encodedScore[1]);
        
        return {
            raw: rawZScore,
            geoCorrected: geoCorrectedZScore
        };
    }

    // Helper to get human-readable description of z-score
    describeZScore(zScore) {
        if (zScore < -2) return 'extremely poor';
        if (zScore < -1) return 'poor';
        if (zScore < -0.5) return 'below average';
        if (zScore < 0.5) return 'normal';
        if (zScore < 1) return 'above average';
        if (zScore < 2) return 'good';
        return 'excellent';
    }

    // Get character at a specific position
    getCharAtPosition(position) {
        if (position < 0 || position > 63) {
            throw new Error('Position must be between 0 and 63');
        }
        return this.base64Chars[position];
    }
}

// Statistics helper for calculating z-scores from latency data
class LatencyStatistics {
    constructor(windowSize = 100) {
        this.windowSize = windowSize;
        this.measurements = new Map(); // targetNode -> array of latencies
    }

    // Add a latency measurement
    addMeasurement(targetNode, latency) {
        if (!this.measurements.has(targetNode)) {
            this.measurements.set(targetNode, []);
        }
        
        const measurements = this.measurements.get(targetNode);
        measurements.push(latency);
        
        // Keep only the most recent measurements
        if (measurements.length > this.windowSize) {
            measurements.shift();
        }
    }

    // Calculate mean and standard deviation for a target node
    getStatistics(targetNode) {
        const measurements = this.measurements.get(targetNode);
        
        if (!measurements || measurements.length < 2) {
            return null;
        }
        
        // Calculate mean
        const mean = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
        
        // Calculate standard deviation
        const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / measurements.length;
        const stdDev = Math.sqrt(variance);
        
        return { mean, stdDev, count: measurements.length };
    }

    // Calculate z-score for a new latency measurement
    calculateZScore(targetNode, latency) {
        const stats = this.getStatistics(targetNode);
        
        if (!stats || stats.stdDev === 0) {
            return 0; // Return normal if insufficient data
        }
        
        return (latency - stats.mean) / stats.stdDev;
    }

    // Get all nodes with sufficient data
    getNodesWithData(minMeasurements = 10) {
        const nodes = [];
        
        for (const [node, measurements] of this.measurements.entries()) {
            if (measurements.length >= minMeasurements) {
                nodes.push(node);
            }
        }
        
        return nodes;
    }

    // Clear old measurements for a specific node
    clearNode(targetNode) {
        this.measurements.delete(targetNode);
    }

    // Get raw measurements for analysis
    getMeasurements(targetNode) {
        return this.measurements.get(targetNode) || [];
    }
}

module.exports = {
    HealthScoreEncoder,
    LatencyStatistics,
    BASE64_CHARS,
    NORMAL_POSITION,
    Z_SCORE_STEP
};