#!/bin/bash
set -euo pipefail  # Exit on error, undefined variables, pipe failures

# =============================================================================
# TROLE INSTALLATION SCRIPT - IMPROVED VERSION (NO GO DEPENDENCY)
# =============================================================================
# This script installs and configures the Trole ecosystem including:
# - IPFS (InterPlanetary File System)
# - SPK Network Node (HoneyComb)
# - Caddy web server with reverse proxy
# - Proof of Access (PoA) services (using pre-built binaries via npm)
# =============================================================================
# IMPROVEMENTS:
# - No Go installation required - uses pre-built ProofOfAccess binaries
# - Faster installation - no compilation from source
# - Smaller footprint - no Snap packages needed for Go
# =============================================================================

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="${SCRIPT_DIR}/install.log"
readonly ENV_FILE="${SCRIPT_DIR}/.env"
readonly BACKUP_DIR="${HOME}/.trole_backups"

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Version constraints
readonly MIN_NODE_VERSION=14
readonly REQUIRED_IPFS_VERSION="v0.26.0"
# Go is no longer required - using pre-built ProofOfAccess binaries

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        INFO)  echo -e "${GREEN}[INFO]${NC} $message" | tee -a "$LOG_FILE" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC} $message" | tee -a "$LOG_FILE" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE" ;;
    esac
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

error_exit() {
    log ERROR "$1"
    exit "${2:-1}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

validate_environment() {
    local whoami_user
    whoami_user=$(whoami)
    
    if [[ "$whoami_user" == "root" ]]; then
        error_exit "Cannot install as root user. Please run as a regular user with sudo privileges."
    fi
    
    if ! groups | grep -q "$whoami_user"; then
        error_exit "User $whoami_user is not part of group $whoami_user. Please add user to group and retry."
    fi
    
    # Check OS compatibility
    if [[ ! -f /etc/os-release ]]; then
        error_exit "Cannot determine OS version. /etc/os-release not found."
    fi
    
    source /etc/os-release
    if [[ "${ID_LIKE:-}" != "debian" ]]; then
        error_exit "This script requires Ubuntu/Debian. Detected: ${PRETTY_NAME:-Unknown}"
    fi
    
    log INFO "Environment validation passed for user: $whoami_user on ${PRETTY_NAME:-Unknown OS}"
}

backup_existing_config() {
    if [[ -f "$ENV_FILE" ]]; then
        mkdir -p "$BACKUP_DIR"
        local backup_file="${BACKUP_DIR}/.env.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$ENV_FILE" "$backup_file"
        log INFO "Backed up existing .env to $backup_file"
    fi
}

create_directories() {
    local dirs=("${HOME}/trole/db" "${HOME}/trole/uploads" "$BACKUP_DIR")
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log INFO "Created directory: $dir"
        fi
    done
}

# =============================================================================
# INPUT VALIDATION AND COLLECTION
# =============================================================================

validate_domain() {
    local domain="$1"
    if [[ ! "$domain" =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$ ]]; then
        return 1
    fi
    return 0
}

validate_hive_account() {
    local account="$1"
    if [[ ! "$account" =~ ^[a-z][a-z0-9.-]{2,15}$ ]]; then
        return 1
    fi
    return 0
}

validate_hive_key() {
    local key="$1"
    # Basic validation - Hive keys start with 5 and are 51-52 characters
    if [[ ! "$key" =~ ^5[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{50,51}$ ]]; then
        return 1
    fi
    return 0
}

prompt_user_input() {
    local var_name="$1"
    local prompt_text="$2"
    local validator_func="${3:-}"
    local hide_input="${4:-false}"
    local input=""
    
    while true; do
        if [[ "$hide_input" == "true" ]]; then
            read -s -p "$prompt_text: " input
            echo
        else
            read -p "$prompt_text: " input
        fi
        
        if [[ -n "$input" ]]; then
            if [[ -n "$validator_func" ]] && ! "$validator_func" "$input"; then
                log WARN "Invalid input format. Please try again."
                continue
            fi
            eval "$var_name='$input'"
            break
        else
            log WARN "Input cannot be empty. Please try again."
        fi
    done
}

collect_configuration() {
    log INFO "Collecting configuration parameters..."
    
    # Load existing environment if available
    if [[ -f "$ENV_FILE" ]]; then
        source "$ENV_FILE"
        log INFO "Loaded existing configuration from .env"
    fi
    
    # Domain configuration
    if [[ -z "${DOMAIN:-}" ]]; then
        prompt_user_input DOMAIN "Enter your domain name (e.g., example.com)" validate_domain
        echo "DOMAIN=${DOMAIN}" >> "$ENV_FILE"
    fi
    log INFO "Domain: $DOMAIN"
    
    # Hive account configuration
    if [[ -z "${ACCOUNT:-}" ]]; then
        prompt_user_input ACCOUNT "Enter your HIVE account name" validate_hive_account
        echo "ACCOUNT=${ACCOUNT}" >> "$ENV_FILE"
    fi
    log INFO "Account: $ACCOUNT"
    
    # Hive active key
    if [[ -z "${ACTIVE:-}" ]]; then
        prompt_user_input ACTIVE "Enter the ACTIVE key for $ACCOUNT" validate_hive_key true
        echo "ACTIVE=${ACTIVE}" >> "$ENV_FILE"
    fi
    log INFO "Active key configured (hidden)"
    
    # Service configuration prompts
    if [[ -z "${BUILDSPK:-}" ]]; then
        while true; do
            read -p "Install SPK Node and Validator? (y/n): " -n 1 -r
            echo
            case $REPLY in
                [Yy]*) BUILDSPK=true; break;;
                [Nn]*) BUILDSPK=false; break;;
                *) log WARN "Please answer y or n.";;
            esac
        done
        echo "BUILDSPK=${BUILDSPK}" >> "$ENV_FILE"
    fi
    
    # Ask for Honeygraph URL if installing SPK node
    if [[ "${BUILDSPK}" == "true" ]] && [[ -z "${HONEYGRAPH_URL:-}" ]]; then
        log INFO "Honeygraph provides read replication for SPK Network nodes"
        read -p "Enter Honeygraph URL (optional, e.g., https://graph.spk.network): " honeygraph_input
        if [[ -n "$honeygraph_input" ]]; then
            HONEYGRAPH_URL="$honeygraph_input"
            echo "HONEYGRAPH_URL=${HONEYGRAPH_URL}" >> "$ENV_FILE"
            log INFO "Honeygraph URL configured: ${HONEYGRAPH_URL}"
            log INFO "Your SPK node will authenticate to Honeygraph using account: ${ACCOUNT}"
        else
            log INFO "No Honeygraph URL provided, continuing without read replication"
        fi
    fi
    
    if [[ -z "${BUILDVAL:-}" ]]; then
        while true; do
            read -p "Register as Validator? (y/n): " -n 1 -r
            echo
            case $REPLY in
                [Yy]*) BUILDVAL=true; break;;
                [Nn]*) BUILDVAL=false; break;;
                *) log WARN "Please answer y or n.";;
            esac
        done
        echo "BUILDVAL=${BUILDVAL}" >> "$ENV_FILE"
    fi
    
    # Set default values for other configuration
    local whoami_user
    whoami_user=$(whoami)
    {
        echo "domain=${DOMAIN}"
        echo "account=${ACCOUNT}"
        echo "active=${ACTIVE}"
        echo "mirrorNet=true"
        echo "API_PORT=${API_PORT:-5050}"
        echo "ENDPOINT=${ENDPOINT:-127.0.0.1}"
        echo "ENDPORT=${ENDPORT:-5001}"
        echo "POA_URL=${POA_URL:-ws://localhost:8001}"
        echo "VALIDATOR=${BUILDVAL}"
        echo "ipfshost=127.0.0.1"
        echo "ipfsprotocol=http"
        echo "ipfsport=5001"
        echo "STARTURL=https://rpc.ecency.com/"
        echo "APIURL=https://rpc.ecency.com/"
        echo "UPLOAD_DIR=/home/${whoami_user}/trole/uploads"
    } >> "$ENV_FILE"
    
    # Handle SPK keys
    handle_spk_keys
    
    log INFO "Configuration collection completed"
}

handle_spk_keys() {
    if [[ -z "${SPKPRIV:-}" ]]; then
        while true; do
            read -p "Do you have existing SPK keypair? (y/n): " -n 1 -r
            echo
            case $REPLY in
                [Yy]*)
                    prompt_user_input SPKPRIV "Enter your SPK private key" "" true
                    prompt_user_input SPKPUB "Enter your SPK public key"
                    break;;
                [Nn]*)
                    # Check if Node.js is available for key generation
                    if ! command_exists node; then
                        log WARN "Node.js is not installed yet. You'll need to provide SPK keys manually."
                        log INFO "You can generate keys later using: node generate_key_pair.js"
                        prompt_user_input SPKPRIV "Enter your SPK private key (or a placeholder to generate later)" "" true
                        prompt_user_input SPKPUB "Enter your SPK public key (or a placeholder to generate later)"
                    else
                        log INFO "Generating new SPK keypair..."
                        if [[ -f "generate_key_pair.js" ]]; then
                            local key_pair
                            key_pair=$(node generate_key_pair.js)
                            SPKPRIV=$(echo "$key_pair" | cut -d " " -f1)
                            SPKPUB=$(echo "$key_pair" | cut -d " " -f2)
                            log INFO "Generated new SPK keypair"
                        else
                            error_exit "generate_key_pair.js not found. Cannot generate SPK keys."
                        fi
                    fi
                    break;;
                *) log WARN "Please answer y or n.";;
            esac
        done
        
        {
            echo "SPKPRIV=${SPKPRIV}"
            echo "SPKPUB=${SPKPUB}"
            echo "msowner=${SPKPRIV}"
            echo "mspublic=${SPKPUB}"
        } >> "$ENV_FILE"
    fi
}

# =============================================================================
# SYSTEM DEPENDENCIES INSTALLATION
# =============================================================================

update_system() {
    log INFO "Updating system packages..."
    if ! sudo apt update >/dev/null; then
        error_exit "Failed to update package lists"
    fi
    log INFO "System packages updated successfully"
}

install_nodejs() {
    if command_exists node; then
        local node_version
        node_version=$(node -v | cut -f1 -d. | sed 's/v//')
        if [[ "$node_version" -ge "$MIN_NODE_VERSION" ]]; then
            log INFO "Node.js $(node -v) is already installed and meets requirements"
            return 0
        else
            log WARN "Node.js version $node_version is below minimum required version $MIN_NODE_VERSION"
        fi
    fi
    
    log INFO "Installing Node.js..."
    if ! curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -; then
        error_exit "Failed to add Node.js repository"
    fi
    
    if ! sudo apt install -y nodejs; then
        error_exit "Failed to install Node.js"
    fi
    
    # Verify installation
    if ! command_exists node || ! command_exists npm; then
        error_exit "Node.js installation verification failed"
    fi
    
    log INFO "Node.js $(node -v) and npm $(npm -v) installed successfully"
}

install_trole_dependencies() {
    log INFO "Installing Trole Node.js dependencies..."
    
    if [[ ! -f "package.json" ]]; then
        error_exit "package.json not found. Please run this script from the Trole directory."
    fi
    
    # Check if package.json includes ProofOfAccess dependency
    if ! grep -q "@disregardfiat/proofofaccess" package.json; then
        log WARN "ProofOfAccess dependency not found in package.json"
        log WARN "ProofOfAccess binary may not be available"
        # Continue anyway - the package.json might be from an older version
    fi
    
    if [[ -d "node_modules" ]]; then
        log INFO "Node modules already exist, updating..."
        if ! npm update; then
            log WARN "npm update failed, trying fresh install..."
            rm -rf node_modules package-lock.json
        fi
    fi
    
    if [[ ! -d "node_modules" ]]; then
        log INFO "Installing npm dependencies (this includes ProofOfAccess binaries)..."
        if ! npm install; then
            error_exit "Failed to install Node.js dependencies"
        fi
    fi
    
    # Verify ProofOfAccess binary was installed
    if [[ ! -f "node_modules/.bin/proofofaccess" ]]; then
        error_exit "ProofOfAccess binary not found after npm install. Please check npm logs."
    fi
    
    log INFO "Trole dependencies installed successfully (including ProofOfAccess binary)"
}

install_ipfs() {
    if command_exists ipfs; then
        local ipfs_version
        ipfs_version=$(ipfs version --number)
        log INFO "IPFS $ipfs_version is already installed"
        return 0
    fi
    
    log INFO "Installing IPFS (Kubo)..."
    local temp_dir
    temp_dir=$(mktemp -d)
    
    pushd "$temp_dir" >/dev/null || error_exit "Failed to change to temporary directory"
    
    if ! wget -q "https://github.com/ipfs/kubo/releases/download/${REQUIRED_IPFS_VERSION}/kubo_${REQUIRED_IPFS_VERSION}_linux-amd64.tar.gz"; then
        error_exit "Failed to download IPFS"
    fi
    
    if ! tar -xzf "kubo_${REQUIRED_IPFS_VERSION}_linux-amd64.tar.gz"; then
        error_exit "Failed to extract IPFS archive"
    fi
    
    if ! sudo bash kubo/install.sh >/dev/null; then
        error_exit "Failed to install IPFS"
    fi
    
    popd >/dev/null
    rm -rf "$temp_dir"
    
    if ! command_exists ipfs; then
        error_exit "IPFS installation verification failed"
    fi
    
    log INFO "IPFS $(ipfs version --number) installed successfully"
}

configure_ipfs() {
    local ipfs_config_file="${HOME}/.ipfs/config"
    
    if [[ ! -f "$ipfs_config_file" ]]; then
        log INFO "Initializing IPFS..."
        if ! ipfs init --profile server >/dev/null; then
            error_exit "Failed to initialize IPFS"
        fi
    else
        log INFO "IPFS configuration already exists"
    fi
    
    log INFO "Configuring IPFS CORS settings..."
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST"]'
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'
    ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers '["Location"]'
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
    
    # Get and store IPFS ID
    local ipfs_id
    ipfs_id=$(ipfs id --format="<id>")
    
    if [[ -z "${IPFSID:-}" ]]; then
        echo "IPFSID=${ipfs_id}" >> "$ENV_FILE"
        log INFO "IPFS ID stored: $ipfs_id"
    elif [[ "$ipfs_id" != "$IPFSID" ]]; then
        log WARN "IPFS ID has changed from $IPFSID to $ipfs_id"
        while true; do
            read -p "Update IPFSID in .env? (y/n): " -n 1 -r
            echo
            case $REPLY in
                [Yy]*) 
                    sed -i "s/IPFSID=.*/IPFSID=${ipfs_id}/" "$ENV_FILE"
                    log INFO "IPFS ID updated in .env"
                    break;;
                [Nn]*) 
                    log INFO "IPFS ID not updated"
                    break;;
                *) log WARN "Please answer y or n.";;
            esac
        done
    fi
}

# Go installation is no longer needed - using pre-built ProofOfAccess binaries
# This function is kept for reference but not called
# install_go() - REMOVED

install_caddy() {
    if command_exists caddy; then
        log INFO "Caddy is already installed"
        return 0
    fi
    
    log INFO "Installing Caddy web server..."
    
    if ! sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https; then
        error_exit "Failed to install Caddy prerequisites"
    fi
    
    if ! curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg; then
        error_exit "Failed to add Caddy GPG key"
    fi
    
    if ! curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null; then
        error_exit "Failed to add Caddy repository"
    fi
    
    if ! sudo apt update >/dev/null; then
        error_exit "Failed to update package lists after adding Caddy repository"
    fi
    
    if ! sudo apt install -y caddy; then
        error_exit "Failed to install Caddy"
    fi
    
    log INFO "Caddy installed successfully"
}

# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

create_systemd_service() {
    local service_name="$1"
    local service_file="/lib/systemd/system/${service_name}.service"
    local service_content="$2"
    
    if [[ -f "$service_file" ]]; then
        log INFO "$service_name service already exists"
        return 0
    fi
    
    log INFO "Creating $service_name systemd service..."
    echo -e "$service_content" | sudo tee "$service_file" >/dev/null
    sudo systemctl daemon-reload
    log INFO "$service_name service created successfully"
}

manage_service() {
    local service_name="$1"
    local enable_service="${2:-true}"
    
    # Start service if not active
    if ! sudo systemctl is-active --quiet "$service_name"; then
        log INFO "Starting $service_name service..."
        if ! sudo systemctl start "$service_name"; then
            error_exit "$service_name service failed to start"
        fi
    else
        log INFO "$service_name service is already running"
    fi
    
    # Enable service for auto-start if requested
    if [[ "$enable_service" == "true" ]]; then
        if ! sudo systemctl is-enabled --quiet "$service_name"; then
            log INFO "Enabling $service_name for auto-start..."
            sudo systemctl enable "$service_name"
        else
            log INFO "$service_name is already enabled for auto-start"
        fi
    fi
    
    # Verify service is running
    if ! sudo systemctl is-active --quiet "$service_name"; then
        error_exit "$service_name service is not running after start attempt"
    fi
    
    log INFO "$service_name service is running successfully"
}

setup_ipfs_service() {
    local whoami_user
    whoami_user=$(whoami)
    
    local service_content="[Unit]
Description=IPFS daemon
After=network.target

[Service]
Type=notify
ExecStart=/usr/local/bin/ipfs daemon --enable-pubsub-experiment --enable-gc
Restart=on-failure
RestartSec=5
User=${whoami_user}
Group=${whoami_user}
Environment=\"IPFS_PATH=/home/${whoami_user}/.ipfs\"

[Install]
WantedBy=multi-user.target"
    
    create_systemd_service "ipfs" "$service_content"
    manage_service "ipfs"
}

setup_trole_service() {
    local whoami_user
    whoami_user=$(whoami)
    
    # Ensure uploads directory has proper permissions
    local uploads_dir="/home/${whoami_user}/trole/uploads"
    if [[ -d "$uploads_dir" ]]; then
        chmod 755 "$uploads_dir"
        chown "${whoami_user}:${whoami_user}" "$uploads_dir"
        log INFO "Set permissions for uploads directory: $uploads_dir"
    fi
    
    local service_content="[Unit]
Description=Trole Node
After=network.target ipfs.service
Requires=ipfs.service

[Service]
Type=simple
WorkingDirectory=/home/${whoami_user}/trole
ExecStart=/usr/bin/node /home/${whoami_user}/trole/index.js
Restart=on-failure
RestartSec=5
User=${whoami_user}
Group=${whoami_user}
Environment=NODE_ENV=production
Environment=UPLOAD_DIR=/home/${whoami_user}/trole/uploads

[Install]
WantedBy=multi-user.target"
    
    create_systemd_service "trole" "$service_content"
    manage_service "trole"
}

setup_spk_service() {
    if [[ "${BUILDSPK:-false}" != "true" ]]; then
        log INFO "Skipping SPK service setup (not requested)"
        return 0
    fi
    
    local whoami_user
    whoami_user=$(whoami)
    local honeycomb_dir="${HOME}/honeycomb"
    
    # Clone and setup honeycomb if not exists
    if [[ ! -d "$honeycomb_dir" ]]; then
        log INFO "Cloning HoneyComb SPK node..."
        if ! git clone https://github.com/spknetwork/honeycomb-spkcc.git "$honeycomb_dir"; then
            error_exit "Failed to clone HoneyComb repository"
        fi
        
        pushd "$honeycomb_dir" >/dev/null
        if ! git checkout 1.2-poa; then
            log WARN "Failed to checkout 1.2-poa branch, using default"
        fi
        
        if ! npm install; then
            error_exit "Failed to install HoneyComb dependencies"
        fi
        
        # Copy environment file
        cp "$ENV_FILE" "${honeycomb_dir}/.env"
        echo "DOMAIN=spk.${DOMAIN}" >> "${honeycomb_dir}/.env"
        
        # Configure Honeygraph authentication if endpoint is provided
        if [[ -n "${HONEYGRAPH_URL:-}" ]]; then
            log INFO "Configuring Honeygraph authentication..."
            echo "" >> "${honeycomb_dir}/.env"
            echo "# Honeygraph Configuration" >> "${honeycomb_dir}/.env"
            echo "HONEYGRAPH_URL=${HONEYGRAPH_URL}" >> "${honeycomb_dir}/.env"
            echo "HONEYGRAPH_AUTH_ENABLED=true" >> "${honeycomb_dir}/.env"
            echo "# Honeygraph will authenticate using this node's Hive account: ${ACCOUNT}" >> "${honeycomb_dir}/.env"
            log INFO "Honeygraph authentication configured for account: ${ACCOUNT}"
        fi
        
        popd >/dev/null
    fi
    
    local service_content="[Unit]
Description=SPK Network Node (HoneyComb)
After=network.target ipfs.service
Requires=ipfs.service

[Service]
Type=simple
WorkingDirectory=/home/${whoami_user}/honeycomb
ExecStart=/usr/bin/node /home/${whoami_user}/honeycomb/index.mjs
Restart=on-failure
RestartSec=5
User=${whoami_user}
Group=${whoami_user}
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target"
    
    create_systemd_service "spk" "$service_content"
    manage_service "spk"
}

setup_poa_service() {
    local whoami_user
    whoami_user=$(whoami)
    
    # ProofOfAccess binary is installed via npm as @disregardfiat/proofofaccess
    # The binary will be available at node_modules/.bin/proofofaccess after npm install
    local poa_binary="${HOME}/trole/node_modules/.bin/proofofaccess"
    
    # Check if binary exists after npm install
    if [[ ! -f "$poa_binary" ]]; then
        log ERROR "ProofOfAccess binary not found at $poa_binary"
        log INFO "Please ensure npm install has completed successfully"
        error_exit "ProofOfAccess binary not found"
    fi
    
    # Create data directory for PoA
    local poa_data_dir="${HOME}/proofofaccess/data"
    mkdir -p "$poa_data_dir"
    log INFO "Created PoA data directory at $poa_data_dir"
    
    local service_content="[Unit]
Description=Proof of Access Node
After=network.target ipfs.service
Requires=ipfs.service

[Service]
Type=simple
WorkingDirectory=/home/${whoami_user}
ExecStart=/home/${whoami_user}/trole/node_modules/.bin/proofofaccess -node 2 -username ${ACCOUNT} -WS_PORT=8000 -useWS=true -honeycomb=true -IPFS_PORT=5001
Restart=on-failure
RestartSec=5
User=${whoami_user}
Group=${whoami_user}
Environment="HOME=/home/${whoami_user}"

[Install]
WantedBy=multi-user.target"
    
    create_systemd_service "poa" "$service_content"
    manage_service "poa"
    
    # Setup validator service if requested
    if [[ "${BUILDSPK:-false}" == "true" ]]; then
        setup_poav_service
    fi
}

setup_poav_service() {
    local whoami_user
    whoami_user=$(whoami)
    
    local service_content="[Unit]
Description=Proof of Access Validator
After=network.target ipfs.service poa.service
Requires=ipfs.service

[Service]
Type=simple
WorkingDirectory=/home/${whoami_user}
ExecStart=/home/${whoami_user}/trole/node_modules/.bin/proofofaccess -node 1 -username validator1 -WS_PORT=8001 -useWS=true -honeycomb=true -IPFS_PORT=5001
Restart=on-failure
RestartSec=5
User=${whoami_user}
Group=${whoami_user}
Environment="HOME=/home/${whoami_user}"

[Install]
WantedBy=multi-user.target"
    
    create_systemd_service "poav" "$service_content"
    
    # Only enable if validator mode is requested
    local enable_validator="${BUILDVAL:-false}"
    manage_service "poav" "$enable_validator"
}

# =============================================================================
# CADDY CONFIGURATION
# =============================================================================

configure_caddy() {
    local caddy_file="/etc/caddy/Caddyfile"
    local caddy_pattern="ipfs.${DOMAIN}"
    
    if grep -q "$caddy_pattern" "$caddy_file" 2>/dev/null; then
        log INFO "Caddy configuration already exists for $DOMAIN"
        log WARN "To update Caddy config, remove existing config from $caddy_file and run script again"
        return 0
    fi
    
    if [[ ! -f "Caddyfile.template" ]]; then
        error_exit "Caddyfile.template not found. Cannot configure Caddy."
    fi
    
    log INFO "Configuring Caddy with domain $DOMAIN..."
    
    # Generate Caddyfile from template
    local whoami_user
    whoami_user=$(whoami)
    local upload_dir="/home/${whoami_user}/trole/uploads"
    
    if ! sed -e "s/{{DOMAIN}}/${DOMAIN}/g" \
             -e "s/{{API_PORT}}/${API_PORT:-5050}/g" \
             -e "s|{{UPLOAD_DIR}}|${upload_dir}|g" \
             Caddyfile.template | sudo tee -a "$caddy_file" >/dev/null; then
        error_exit "Failed to update Caddy configuration"
    fi
    
    # Test Caddy configuration
    if ! sudo caddy validate --config "$caddy_file"; then
        error_exit "Caddy configuration validation failed"
    fi
    
    # Restart Caddy to apply new configuration
    if ! sudo systemctl restart caddy; then
        error_exit "Failed to restart Caddy"
    fi
    
    log INFO "Caddy configured successfully"
}

# =============================================================================
# NODE REGISTRATION
# =============================================================================

register_node() {
    if [[ ! -f "register_node.js" ]]; then
        log WARN "register_node.js not found. Skipping node registration."
        return 0
    fi
    
    log INFO "Registering node services..."
    
    # Ensure all required services are running before registration
    local required_services=("ipfs" "trole")
    for service in "${required_services[@]}"; do
        if ! sudo systemctl is-active --quiet "$service"; then
            log WARN "$service is not running. Registration may fail."
        fi
    done
    
    # Run registration with timeout
    if timeout 60 node register_node.js; then
        log INFO "Node registration completed successfully"
    else
        log WARN "Node registration failed or timed out"
    fi
}

# =============================================================================
# CLEANUP AND FINALIZATION
# =============================================================================

cleanup_temp_files() {
    log INFO "Cleaning up temporary files..."
    
    # Remove any temporary archives
    find "$SCRIPT_DIR" -name "*.tar.gz" -mtime +1 -delete 2>/dev/null || true
    
    # Remove old log files (keep last 10)
    find "$SCRIPT_DIR" -name "install.log.*" -type f | sort -r | tail -n +11 | xargs rm -f 2>/dev/null || true
    
    log INFO "Cleanup completed"
}

display_final_status() {
    log INFO "Installation completed successfully!"
    echo
    echo -e "${GREEN}=== TROLE INSTALLATION SUMMARY ===${NC}"
    echo -e "${GREEN}=== (Improved Version - No Go Required) ===${NC}"
    echo -e "${BLUE}Domain:${NC} $DOMAIN"
    echo -e "${BLUE}Account:${NC} $ACCOUNT"
    echo -e "${BLUE}Upload Directory:${NC} ${UPLOAD_DIR:-/home/$(whoami)/trole/uploads}"
    echo -e "${BLUE}ProofOfAccess:${NC} Using pre-built binary from npm"
    echo -e "${BLUE}Services installed:${NC}"
    
    local services=("ipfs" "trole")
    if [[ "${BUILDSPK:-false}" == "true" ]]; then
        services+=("spk")
    fi
    services+=("poa")
    if [[ "${BUILDSPK:-false}" == "true" ]]; then
        services+=("poav")
    fi
    services+=("caddy")
    
    for service in "${services[@]}"; do
        if sudo systemctl is-active --quiet "$service"; then
            echo -e "${GREEN}  ✓ $service${NC}"
        else
            echo -e "${RED}  ✗ $service${NC}"
        fi
    done
    
    echo
    echo -e "${YELLOW}DNS Requirements:${NC}"
    echo -e "  - ipfs.$DOMAIN should point to this server"
    if [[ "${BUILDSPK:-false}" == "true" ]]; then
        echo -e "  - spk.$DOMAIN should point to this server"
    fi
    if [[ "${BUILDVAL:-false}" == "true" ]]; then
        echo -e "  - poa.$DOMAIN should point to this server"
    fi
    
    echo
    
    if [[ -n "${HONEYGRAPH_URL:-}" ]]; then
        echo -e "${YELLOW}Honeygraph Configuration:${NC}"
        echo -e "  - URL: ${HONEYGRAPH_URL}"
        echo -e "  - Authentication: Using Hive account ${ACCOUNT}"
        echo -e "  - The SPK node will authenticate automatically"
        echo
    fi
    
    echo -e "${YELLOW}Important:${NC}"
    echo -e "  - Your .env file contains sensitive keys"
    echo -e "  - A backup has been created in: $BACKUP_DIR"
    echo -e "  - Keep your .env file secure and backed up"
    echo -e "  - Installation log saved to: $LOG_FILE"
    echo
}

# =============================================================================
# MAIN INSTALLATION FLOW
# =============================================================================

main() {
    log INFO "Starting Trole installation script..."
    log INFO "Log file: $LOG_FILE"
    
    # Pre-installation checks
    validate_environment
    backup_existing_config
    create_directories
    
    # System updates and install Node.js first
    update_system
    install_nodejs
    
    # Install npm dependencies BEFORE configuration (includes ProofOfAccess binary)
    install_trole_dependencies
    
    # Now collect configuration (node and npm packages are available)
    collect_configuration
    source "$ENV_FILE"  # Reload updated environment
    install_ipfs
    configure_ipfs
    # Go installation removed - using pre-built ProofOfAccess binaries
    install_caddy
    
    # Service setup
    setup_ipfs_service
    setup_trole_service
    setup_spk_service
    setup_poa_service
    
    # Configuration
    configure_caddy
    
    # Registration and finalization
    register_node
    cleanup_temp_files
    display_final_status
    
    log INFO "Trole installation completed successfully!"
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Create log file and redirect stderr
exec 2> >(tee -a "$LOG_FILE")

# Check if running as root (should exit early)
if [[ $EUID -eq 0 ]]; then
    error_exit "This script should not be run as root. Please run as a regular user with sudo privileges."
fi

# Handle script interruption
trap 'log ERROR "Installation interrupted by user"; exit 130' INT
trap 'log ERROR "Installation failed unexpectedly on line $LINENO"; exit 1' ERR

# Run main installation
main "$@"

exit 0