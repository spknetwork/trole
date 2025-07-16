# IPFS Compatibility Guide for Trole

## Problem
The IPFS daemon is returning multiaddresses with protocols (`tls`, `quic-v1`) that ipfs-http-client v56 doesn't support.

## Solutions

### Option 1: Configure IPFS Daemon (Recommended)
Edit your IPFS config to use only HTTP without TLS/QUIC:

```bash
# Check current API address
ipfs config Addresses.API

# Set to HTTP only (no TLS)
ipfs config Addresses.API /ip4/127.0.0.1/tcp/5001

# Disable QUIC in swarm addresses
ipfs config --json Addresses.Swarm '[
  "/ip4/0.0.0.0/tcp/4001",
  "/ip6/::/tcp/4001"
]'

# Restart IPFS daemon
ipfs shutdown
ipfs daemon
```

### Option 2: Use Compatible IPFS Version
Downgrade to IPFS daemon v0.12.x or earlier which doesn't use these newer protocols by default.

### Option 3: Update Trole Client (Complex)
Update to latest ipfs-http-client (v60+) which requires:
- Converting entire codebase to ES modules
- Node.js 16+ with ESM support
- Major refactoring

### Option 4: Use IPFS HTTP API Directly
Skip the client library and use direct HTTP API calls:
```javascript
// Instead of ipfs.id()
fetch('http://127.0.0.1:5001/api/v0/id', { method: 'POST' })
```

## Current Status
Trole continues to function without IPFS:
- ✅ HTTP API endpoints work
- ✅ Contract cleanup safely skipped
- ✅ No data loss risk
- ❌ IPFS pinning/unpinning unavailable
- ❌ File storage features disabled

## Verification
Check if IPFS is properly configured:
```bash
curl -X POST http://127.0.0.1:5001/api/v0/id
```

If this works, the daemon is accessible via HTTP.