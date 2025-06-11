# Trole Deployment Quick Reference

This guide provides quick commands and configurations for different deployment scenarios.

## 🏃‍♂️ Quick Start Commands

### Docker Development
```bash
git clone https://github.com/spknetwork/trole && cd trole
cp env.sample .env && nano .env
docker-compose up -d
```

### Docker Production
```bash
git clone https://github.com/spknetwork/trole && cd trole
cp env.sample .env && nano .env
echo "NODE_ENV=production" >> .env
docker-compose -f docker-compose.prod.yml up -d
```

### Native Installation
```bash
git clone https://github.com/spknetwork/trole && cd trole
cp env.sample .env && nano .env
chmod +x install.sh && ./install.sh
```

## 🔧 Configuration Templates

### Basic .env Configuration
```bash
# Required Settings
ACCOUNT=your-hive-username
ACTIVE=5K...your-active-key-here...

# Optional Settings  
DOMAIN=yourdomain.com
PORT=5050
ENDPOINT=127.0.0.1
ENDPORT=5001
BUILDSPK=false
BUILDVAL=false
```

### Production .env Configuration
```bash
# Required Settings
ACCOUNT=your-hive-username
ACTIVE=5K...your-active-key-here...

# Production Settings
DOMAIN=yourdomain.com
NODE_ENV=production
PORT=5050
ENDPOINT=127.0.0.1
ENDPORT=5001

# SPK Network Settings
BUILDSPK=true
BUILDVAL=true
SPKPRIV=your-spk-private-key
SPKPUB=your-spk-public-key
```

## 🐳 Docker Compose Files Comparison

| File | Use Case | Features |
|------|----------|----------|
| `docker-compose.yml` | Development/Testing | Basic setup, bridge networking |
| `docker-compose.prod.yml` | Production | Security hardened, resource limits |
| `docker-host.yml` | Network Issues | Host networking mode |
| `full-docker.yml` | Development | Full logging, health checks |

## 🚀 Service Management Commands

### Docker Commands
```bash
# Start services
docker-compose up -d

# View logs  
docker-compose logs -f --tail=100

# Restart specific service
docker-compose restart trole_api

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose down && docker-compose build && docker-compose up -d
```

### System Service Commands (Native Install)
```bash
# Check service status
sudo systemctl status trole ipfs caddy

# Start/stop services
sudo systemctl start trole
sudo systemctl stop trole

# View logs
sudo journalctl -fu trole -n 100

# Restart services
sudo systemctl restart trole ipfs
```

## 🔍 Health Check URLs

| Service | Health Check URL | Expected Response |
|---------|------------------|-------------------|
| Trole API | `http://localhost:5050/upload-stats` | JSON with stats |
| IPFS Gateway | `http://localhost:8080/ipfs/QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn` | "Hello World" |
| IPFS API | `http://localhost:5001/api/v0/version` | JSON with version |

## 🛠️ Common Troubleshooting

### Docker Issues
```bash
# Permission errors
sudo chown -R 1001:1001 ./db

# Network conflicts
docker network prune -f

# Clean rebuild
docker-compose down -v
docker system prune -f
docker-compose build --no-cache
docker-compose up -d
```

### IPFS Issues
```bash
# Reset IPFS config
rm -rf ~/.ipfs
ipfs init --profile server

# Check IPFS peers
ipfs swarm peers

# Test IPFS API
curl -X POST http://localhost:5001/api/v0/version
```

## 📊 Monitoring Setup

### Basic Monitoring Script
```bash
#!/bin/bash
# save as monitor.sh and run: chmod +x monitor.sh && ./monitor.sh

echo "=== Trole Service Status ==="
curl -s http://localhost:5050/upload-stats | jq '.ipfsId, .nodeId, .repoSize'

echo -e "\n=== Docker Container Status ==="
docker-compose ps

echo -e "\n=== Resource Usage ==="
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Log Aggregation
```bash
# Centralized logging
docker-compose logs -f > trole.log 2>&1 &

# Log rotation setup
sudo logrotate -d /etc/logrotate.d/trole
```

## 🔐 Security Checklist

### Production Security
- [ ] Use strong, unique passwords
- [ ] Enable firewall (ufw/iptables)
- [ ] Configure SSL certificates
- [ ] Restrict API access to localhost
- [ ] Regular security updates
- [ ] Monitor access logs
- [ ] Backup configuration files

### Docker Security
- [ ] Run containers as non-root user
- [ ] Use read-only filesystems where possible
- [ ] Set resource limits
- [ ] Enable security options (no-new-privileges)
- [ ] Regular image updates
- [ ] Scan images for vulnerabilities

## 📈 Performance Tuning

### IPFS Optimization
```bash
# Increase connection limits
ipfs config Swarm.ConnMgr.HighWater 900
ipfs config Swarm.ConnMgr.LowWater 600

# Enable experimental features
ipfs config --json Experimental.FilestoreEnabled true
ipfs config --json Experimental.Libp2pStreamMounting true
```

### System Resources
```bash
# Increase file descriptor limits
echo "fs.file-max = 65536" >> /etc/sysctl.conf
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf
```

## 🔄 Backup and Recovery

### Configuration Backup
```bash
# Backup configuration
tar -czf trole-backup-$(date +%Y%m%d).tar.gz .env docker-compose*.yml

# Backup IPFS data
tar -czf ipfs-backup-$(date +%Y%m%d).tar.gz ~/.ipfs
```

### Recovery Process
```bash
# Restore configuration
tar -xzf trole-backup-YYYYMMDD.tar.gz

# Restore IPFS
systemctl stop ipfs
rm -rf ~/.ipfs
tar -xzf ipfs-backup-YYYYMMDD.tar.gz
systemctl start ipfs
``` 