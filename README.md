# Trole

**Trole** is a role-based reverse proxy that controls access to decentralized services based on Hive blockchain credentials. It verifies structured messages signed by valid Hive `posting` or `active` keys before bridging requests to backend services.

This implementation controls upload access to decentralized IPFS nodes on the SPK Network and provides secure, authenticated gateway functionality.

## ✨ Features

- **Blockchain Authentication**: Verifies Hive blockchain signatures
- **Role-Based Access Control**: Controls access based on account permissions
- **IPFS Gateway**: Secure upload/download functionality
- **Intelligent CDN**: Smart content routing and performance optimization
- **Docker Support**: Multiple deployment configurations
- **Health Monitoring**: Built-in health checks and monitoring

## 📤 Content Upload & Storage Management

Trole implements a sophisticated **blockchain-verified storage system** (`api.js`) that manages secure file uploads, storage contracts, and decentralized content distribution across the SPK Network.

### Upload Architecture

The system uses a **chunked upload approach** with blockchain-based contracts to ensure secure, verifiable content storage:

1. **Contract Creation**: Users establish storage contracts via SPK Network blockchain
2. **Chunked Upload**: Files are uploaded in chunks with range headers for resumable transfers
3. **CID Verification**: Content integrity verified by comparing calculated hash with expected CID
4. **IPFS Pinning**: Successfully uploaded files are pinned to local IPFS node
5. **Contract Completion**: Full contract details broadcasted to blockchain upon completion

### Key Storage Features

- **🔗 Blockchain Contracts**: All storage agreements recorded on SPK Network blockchain
- **📋 Chunked Uploads**: Resumable uploads with precise chunk management
- **🔍 CID Verification**: Cryptographic verification of content integrity  
- **📌 IPFS Pinning**: Automatic pinning to distributed storage network
- **💾 Local Staging**: Temporary local storage during upload process
- **🗑️ Automated Cleanup**: Smart cleanup of expired contracts and orphaned files
- **📊 Storage Analytics**: Real-time monitoring of storage usage and capacity

### Upload Process Flow

```
Client Request → Contract Validation → Chunk Processing → CID Verification 
     ↓                                                            ↓
Blockchain Signature Verification                          IPFS Pinning
     ↓                                                            ↓
Temporary File Storage → Upload Completion → Contract Broadcasting
```

### Storage Management

**Automated Inventory System:**
- Periodic scanning of pinned content vs. active contracts  
- Automatic re-pinning of missing content
- Cleanup of expired or invalid contracts
- Real-time storage statistics and disk usage monitoring

**Contract Lifecycle Management:**
- Real-time contract status monitoring via SPK Network API
- Automatic content removal when contracts expire or are cancelled
- Multi-node coordination for distributed storage agreements
- Reward distribution tracking for storage providers

### Storage API Endpoints

| Endpoint | Method | Purpose | Key Features |
|----------|--------|---------|-------------|
| `/upload` | POST | Upload file chunks | Range headers, CID verification, resumable uploads |
| `/upload-contract` | GET | Create storage contract | Blockchain verification, user validation |
| `/upload-check` | GET | Check upload status | Progress tracking, chunk validation |
| `/upload-authorize` | GET | Authorize file uploads | Multi-file authorization, signature verification |
| `/upload-stats` | GET | Storage statistics | Real-time capacity, repo stats, contract counts |
| `/contracts` | GET | List active contracts | Complete contract details and status |
| `/storage-stats` | GET | Detailed storage metrics | Disk usage, IPFS repo stats, active contracts |

### Security & Verification

**Multi-Layer Security:**
- **Hive Blockchain Signatures**: All operations require valid posting/active key signatures
- **Content Integrity**: Hash-based verification ensures uploaded content matches expected CID
- **Contract Validation**: Cross-reference with SPK Network blockchain for authentic contracts
- **Access Control**: Role-based permissions tied to blockchain account ownership
- **Automatic Flagging**: Content moderation system with blockchain-verified flag operations

**Data Integrity Assurance:**
- Pre-upload CID calculation and verification
- Post-upload hash comparison with IPFS-generated CID
- Periodic integrity checks of pinned content
- Automatic recovery and re-pinning of corrupted data

## 🎁 Promotional Contracts System

Trole includes an optional **promotional contract system** that enables node operators to automatically issue storage contracts to new users, facilitating easy onboarding and uploading to the SPK Network.

### How Promotional Contracts Work

**Promotional contracts** are special storage agreements that provide new users with free temporary storage allocations to encourage network participation. The system automatically evaluates user eligibility and issues contracts with appropriate storage grants. The user will be responsible for maintaining the resource credits (BROCA POWER) in their account to maintain the storage.

### Key Features

- **🎯 Automatic Issuance**: Contracts automatically created for eligible users
- **⚡ Rate Limiting**: Built-in debouncer prevents abuse (10-minute cooldown per user)
- **📊 Dynamic Allocation**: Storage grants adjust based on network capacity and user history
- **🔐 Blockchain Verification**: All contracts recorded on SPK Network blockchain
- **💰 Resource Management**: Intelligent allocation based on available network resources

### Configuration

**Environment Variables:**
- `PROMO_CONTRACT=true` - Enable promotional contract system
- `BASE_GRANT=30000` - Base storage allocation in bytes
- `SPK_API` - SPK Network API endpoint for user verification

**Eligibility Criteria:**
- User must have valid SPK Network account
- User must not have existing contract with the node
- User account must have valid public key
- Rate limit: One request per user every 10 minutes

### API Endpoints

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|------------|
| `/upload-promo-contract` | GET | Create promotional contract | `user` - Target username |
| `/upload-contract` | GET | Create standard contract | `user` - Target username |


### Network Resource Management

The promotional system intelligently manages network resources:

**Capacity Monitoring:**
- Tracks available "broca" (network resource units)
- Monitors SPK power and network capacity
- Adjusts grant sizes based on real-time network utilization

**Historical Allocation Tracking:**
- Remembers previous grants to users
- Adjusts future allocations based on usage patterns
- Prevents resource hoarding through intelligent distribution

### Benefits for Node Operators

1. **User Onboarding**: Simplifies new user acquisition
2. **Network Growth**: Encourages SPK Network participation  
3. **Resource Utilization**: Optimizes storage capacity usage
4. **Community Building**: Enables easy content sharing for newcomers

### Security Considerations

- **Rate Limiting**: Prevents spam and abuse attempts
- **Account Verification**: Cross-references with SPK Network for valid accounts
- **Resource Caps**: Automatic limits prevent resource exhaustion
- **Blockchain Audit Trail**: All contracts recorded for transparency

## 🌐 Intelligent IPFS CDN Network

Trole features an advanced **intelligent SPK IPFS CDN system** (`cdn.js`) that creates a decentralized content delivery network by intelligently routing IPFS requests across multiple gateway nodes based on content ownership, health status, and performance metrics.

### Key CDN Features

- **🎯 Smart Routing**: Automatically routes requests to content claimants (SPK Storage Nodes) for optimal performance
- **💚 Health Monitoring**: Continuous monitoring of gateway health with automatic failover
- **🔍 Content Integrity Verification**: Real-time verification of content authenticity using hash validation
- **📊 Performance Analytics**: Detailed statistics and reward scoring for gateway operators
  - Possible furute SPK network rewarding mechanisms
- **🔄 Load Balancing**: Intelligent distribution across healthy gateways
- **⚡ Caching Strategy**: Optimized caching headers for efficient content delivery

### How the CDN Works

1. **Content Request**: When a user requests `/ipfs/QmHash...`, the system analyzes the CID
2. **Claimant Discovery**: Fetches file ownership information from the SPK Network API
3. **Gateway Selection**: Routes to the content storer's gateway for optimal delivery
4. **Health Check**: Validates gateway availability and content integrity
5. **Fallback Strategy**: Uses backup gateways if primary nodes are unavailable
6. **Performance Tracking**: Records metrics for reward calculations and network optimization

### CDN API Endpoints

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /ipfs/:cid` | Proxy IPFS content through intelligent routing | File content with optimized headers |
| `GET /ipfs-health` | Gateway health status and integrity metrics | JSON health report |
| `GET /ipfs-stats` | Detailed network statistics for rewards | Performance and uptime data |

### Network Intelligence

The CDN system maintains rolling lists of recently accessed CIDs and performs periodic integrity checks to ensure content authenticity. Gateway performance is continuously monitored with scoring algorithms that factor in:

- **Uptime**: Connection reliability and response times
- **Integrity**: Content hash verification success rates
- **Availability**: Consistent service delivery metrics
- **Network Participation**: Active contribution to the decentralized network

## 🚀 Installation Options

Choose the deployment method that best fits your needs:

### 1. 🐳 Docker Deployment (Recommended for Testing)

**Quick start for development and testing environments.**

#### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- Basic understanding of environment configuration

#### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/spknetwork/trole
   cd trole
   ```

2. **Configure environment**
   ```bash
   cp env.sample .env
   # Edit .env with your Hive account credentials
   nano .env
   ```

3. **Deploy services**
   ```bash
   # Standard deployment
   docker-compose build
   docker-compose up -d
   
   # View logs
   docker-compose logs -f --tail="200"
   ```

#### Alternative Docker Configurations

**Host Network Mode** (if you experience networking issues):
```bash
docker-compose -f docker-host.yml build
docker-compose -f docker-host.yml up -d
```

**Development Mode** (with full logging):
```bash
docker-compose -f full-docker.yml up -d
```

### 2. 🏭 Production Docker Deployment

**Secure, production-ready deployment with enhanced features.**

#### Prerequisites
- Docker Engine 20.10+ with Compose v2
- Reverse proxy (Nginx/Caddy) for SSL termination
- Domain name with DNS configuration

#### Setup Steps

1. **Prepare environment**
   ```bash
   git clone https://github.com/spknetwork/trole
   cd trole
   cp env.sample .env
   ```

2. **Configure for production**
   ```bash
   # Edit .env with production credentials
   nano .env
   
   # Add production-specific settings
   echo "NODE_ENV=production" >> .env
   ```

3. **Deploy with production settings**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

**Production Features:**
- ✅ Resource limits and reservations
- ✅ Security hardening (read-only containers, no-new-privileges)
- ✅ Enhanced logging and monitoring
- ✅ Health checks for all services
- ✅ Localhost-only binding for internal services

### 3. 🖥️ Native Installation (Full Node)

**Complete SPK Network node with all components.**

#### Prerequisites
- Ubuntu 20.04+ or Debian 10+ (with sudo privileges)
- Domain name pointed to your server
- Minimum 4GB RAM, 50GB storage

#### Setup Steps

1. **Clone and prepare**
   ```bash
   git clone https://github.com/spknetwork/trole
   cd trole
   cp env.sample .env
   nano .env  # Configure your credentials
   ```

2. **Run installation script**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```

The installer will:
- ✅ Install Node.js, Go, IPFS, and Caddy
- ✅ Configure systemd services
- ✅ Set up SSL certificates (via Caddy)
- ✅ Configure firewall rules
- ✅ Register your node on the network

#### What Gets Installed

| Component | Purpose | Port |
|-----------|---------|------|  
| IPFS Kubo | Decentralized storage | 4001, 5001, 8080 |
| Trole API | Authentication gateway | 5050 |
| SPK Node | Network participation | 8000-8003 |
| Caddy | Reverse proxy & SSL | 80, 443 |

### 4. 📦 Standalone Development

**For development and testing without full node setup.**

#### Prerequisites
- Node.js 18+ 
- IPFS node (local or remote)

#### Setup Steps

```bash
git clone https://github.com/spknetwork/trole
cd trole
npm install
cp env.sample .env
nano .env  # Configure IPFS endpoint

# Start development server
npm start
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ACCOUNT` | Your Hive account name | ✅ | - |
| `ACTIVE` | Hive active private key | ✅ | - |
| `DOMAIN` | Your domain name | 🔶 | localhost |
| `BUILDSPK` | Install SPK components | ❌ | false |
| `BUILDVAL` | Enable validator mode | ❌ | false |
| `PORT` | API server port | ❌ | 5050 |
| `ENDPOINT` | IPFS host | ❌ | 127.0.0.1 |
| `ENDPORT` | IPFS API port | ❌ | 5001 |


### DNS Configuration

For Validator and Gateway deployments, configure these DNS records:

```dns
A     @              YOUR_SERVER_IP
A     ipfs           YOUR_SERVER_IP
A     spk            YOUR_SERVER_IP  # If running SPK node
CNAME www            @
```

## 📊 Monitoring and Management

### Health Checks

```bash
# Check service health
curl http://localhost:5050/upload-stats

# Docker service status
docker-compose ps

# System service status (native install)
sudo systemctl status trole ipfs caddy
```

### Log Management

```bash
# Docker logs
docker-compose logs -f trole_api

# System logs (native install)  
sudo journalctl -fu trole -n 100

# IPFS logs
sudo journalctl -fu ipfs -n 50
```

## 🔧 Troubleshooting

### Common Issues

**Docker Network Problems**
```bash
# Try host networking mode
docker-compose -f docker-host.yml up -d

# Reset Docker networks
docker-compose down
docker network prune -f
docker-compose up -d
```

**IPFS Connection Issues**
```bash
# Check IPFS connectivity
docker-compose exec ipfs ipfs swarm peers

# Restart IPFS
docker-compose restart ipfs
```

**Permission Errors**
```bash
# Fix volume permissions
docker-compose down
sudo chown -R 1001:1001 ./db
docker-compose up -d
```

### Getting Help

1. Check the [issues page](https://github.com/spknetwork/trole/issues)
2. Join our [Discord](https://discord.gg/JbhQ7dREsP)
3. Review logs for error details
4. Ensure your `.env` configuration is correct

## 📡 API Documentation

### Core Endpoints

### Upload File Chunk
- **Endpoint**: `POST /upload`
- **Purpose**: Uploads a file chunk to the server
- **Headers**:
  - `x-contract`: The contract ID
  - `content-range`: The range of the chunk being uploaded (e.g., bytes=0-999/10000)
  - `x-cid`: The CID of the file
- **Body**: The file chunk
- **Response**:
  - 200 OK: Success
  - 400 Bad Request: Missing headers or invalid format
  - 401 Unauthorized: No file with such credentials
  - 402 Payment Required: Invalid Content-Range
  - 403 Forbidden: Bad chunk provided
  - 405 Method Not Allowed: Missing Content-Range header
  - 406 Not Acceptable: Missing x-contract header
  - 500 Internal Server Error: Internal error

### Create Upload Contract
- **Endpoint**: `GET /upload-contract`
- **Purpose**: Creates a new contract for the user
- **Query Parameters**:
  - `user`: The username
- **Response**:
  - 200 OK: Contract sent successfully
  - 400 Bad Request: Contract exists or user pubKey not found

### Check Upload Status
- **Endpoint**: `GET /upload-check`
- **Purpose**: Checks the upload status of a file
- **Headers**:
  - `x-cid`: The CID of the file
  - `x-files`: The list of CIDs
  - `x-account`: The account name
  - `x-sig`: The signature
  - `x-contract`: The contract ID
- **Response**:
  - 200 OK: Total chunk uploaded
  - 400 Bad Request: Missing data or storage mismatch
  - 401 Unauthorized: Access denied

### Authorize Upload
- **Endpoint**: `GET /upload-authorize`
- **Purpose**: Authorizes the upload of files
- **Headers**:
  - `x-cid`: The CID
  - `x-files`: The list of CIDs
  - `x-account`: The account name
  - `x-sig`: The signature
  - `x-contract`: The contract ID
  - `x-meta`: The metadata
- **Response**:
  - 200 OK: Authorized CIDs
  - 400 Bad Request: Missing data
  - 401 Unauthorized: Access denied

### Get Live Statistics
- **Endpoint**: `GET /upload-stats`
- **Purpose**: Provides live statistics of the node
- **Response**:
  - 200 OK: JSON object with IPFS ID, pubKey, head block, node, API, storage max, repo size, and number of objects

### Check Flag Status
- **Endpoint**: `GET /flag-qry/:cid`
- **Purpose**: Checks if a CID is flagged
- **Path Parameters**:
  - `cid`: The CID to check
- **Response**:
  - 200 OK: JSON object with flag set to true or false

### Flag or Unflag CID
- **Endpoint**: `GET /flag`
- **Purpose**: Flags or unflags a CID
- **Query Parameters**:
  - `cid`: The CID to flag/unflag
  - `sig`: The signature
  - `unflag`: Optional, set to true to unflag
- **Response**:
  - 200 OK: JSON object with a message indicating the flag status

### Get All Contracts
- **Endpoint**: `GET /contracts`
- **Purpose**: Retrieves all active contracts
- **Response**:
  - 200 OK: JSON object with an array of contracts

### Get Storage Statistics
- **Endpoint**: `GET /storage-stats`
- **Purpose**: Provides storage statistics
- **Response**:
  - 200 OK: JSON object with disk usage, IPFS repo stats, and active contracts
  - 500 Internal Server Error: Error retrieving data

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Follow existing code style
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔗 Links

- **Discord**: [Join our community](https://discord.gg/JbhQ7dREsP)
- **Documentation**: [Full docs](https://docs.dlux.io)