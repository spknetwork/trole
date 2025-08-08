#!/bin/bash
set -euo pipefail

# =============================================================================
# TROLE UPGRADE SCRIPT - Migrate from Go-compiled to npm-based ProofOfAccess
# =============================================================================
# This script upgrades existing Trole installations to use pre-built
# ProofOfAccess binaries from npm instead of Go-compiled binaries
# =============================================================================

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="${SCRIPT_DIR}/upgrade.log"
readonly BACKUP_DIR="${HOME}/.trole_backups/upgrade_$(date +%Y%m%d_%H%M%S)"

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

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

# =============================================================================
# BACKUP FUNCTIONS
# =============================================================================

create_backup() {
    log INFO "Creating backup of current installation..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup service files if they exist
    local services=("poa" "poav")
    for service in "${services[@]}"; do
        local service_file="/lib/systemd/system/${service}.service"
        if [[ -f "$service_file" ]]; then
            sudo cp "$service_file" "$BACKUP_DIR/${service}.service.bak"
            log INFO "Backed up $service service file"
        fi
    done
    
    # Backup current ProofOfAccess binary if exists
    if [[ -f "${HOME}/proofofaccess/main" ]]; then
        cp "${HOME}/proofofaccess/main" "$BACKUP_DIR/proofofaccess-main.bak"
        log INFO "Backed up ProofOfAccess binary"
    fi
    
    # Backup package.json
    if [[ -f "${SCRIPT_DIR}/package.json" ]]; then
        cp "${SCRIPT_DIR}/package.json" "$BACKUP_DIR/package.json.bak"
        log INFO "Backed up package.json"
    fi
    
    log INFO "Backup created at: $BACKUP_DIR"
}

# =============================================================================
# CHECK FUNCTIONS
# =============================================================================

check_existing_installation() {
    log INFO "Checking existing installation..."
    
    local checks_passed=true
    
    # Check if running in Trole directory
    if [[ ! -f "${SCRIPT_DIR}/package.json" ]]; then
        log ERROR "package.json not found. Please run from Trole directory"
        checks_passed=false
    fi
    
    # Check if services exist
    if [[ ! -f "/lib/systemd/system/poa.service" ]]; then
        log WARN "PoA service not found - might be a fresh installation"
    fi
    
    # Check if old ProofOfAccess installation exists
    if [[ -d "${HOME}/proofofaccess" ]]; then
        log INFO "Found existing ProofOfAccess installation at ${HOME}/proofofaccess"
        if [[ -f "${HOME}/proofofaccess/main" ]]; then
            log INFO "Found compiled ProofOfAccess binary"
        fi
    else
        log WARN "No existing ProofOfAccess installation found"
    fi
    
    # Check if Go is installed (for information)
    if command_exists go; then
        log INFO "Go is installed: $(go version | awk '{print $3}')"
        log INFO "Go can be uninstalled after upgrade if not needed for other projects"
    fi
    
    if [[ "$checks_passed" == "false" ]]; then
        error_exit "Pre-upgrade checks failed"
    fi
}

# =============================================================================
# UPGRADE FUNCTIONS
# =============================================================================

stop_services() {
    log INFO "Stopping ProofOfAccess services..."
    
    local services=("poa" "poav")
    for service in "${services[@]}"; do
        if sudo systemctl is-active --quiet "$service"; then
            log INFO "Stopping $service..."
            sudo systemctl stop "$service"
        fi
    done
    
    # Wait for services to fully stop
    sleep 3
}

update_package_json() {
    log INFO "Updating package.json with ProofOfAccess dependency..."
    
    # Check if already has the dependency
    if grep -q "@disregardfiat/proofofaccess" "${SCRIPT_DIR}/package.json"; then
        log INFO "ProofOfAccess dependency already in package.json"
    else
        # Add ProofOfAccess to dependencies
        log INFO "Adding @disregardfiat/proofofaccess to package.json"
        
        # Use jq if available, otherwise use sed
        if command_exists jq; then
            jq '.dependencies."@disregardfiat/proofofaccess" = "^0.4.5"' "${SCRIPT_DIR}/package.json" > "${SCRIPT_DIR}/package.json.tmp"
            mv "${SCRIPT_DIR}/package.json.tmp" "${SCRIPT_DIR}/package.json"
        else
            # Fallback to sed - insert after first dependency
            sed -i '/"dependencies":/,/}/ s/"@hiveio\/dhive"/"@disregardfiat\/proofofaccess": "^0.4.5",\n    "@hiveio\/dhive"/' "${SCRIPT_DIR}/package.json"
        fi
    fi
}

install_npm_package() {
    log INFO "Installing ProofOfAccess npm package..."
    
    cd "$SCRIPT_DIR"
    
    # Clean install to ensure we get the binary
    if [[ -d "node_modules/@disregardfiat/proofofaccess" ]]; then
        log INFO "Removing old ProofOfAccess npm package..."
        rm -rf "node_modules/@disregardfiat/proofofaccess"
    fi
    
    log INFO "Running npm install..."
    if ! npm install; then
        error_exit "Failed to install npm packages"
    fi
    
    # Verify binary exists
    if [[ ! -f "node_modules/.bin/proofofaccess" ]]; then
        error_exit "ProofOfAccess binary not found after npm install"
    fi
    
    log INFO "ProofOfAccess npm package installed successfully"
}

update_service_files() {
    log INFO "Updating systemd service files..."
    
    local whoami_user=$(whoami)
    
    # Update PoA service
    if [[ -f "/lib/systemd/system/poa.service" ]]; then
        log INFO "Updating poa.service..."
        
        # Create new service file content
        local poa_service="[Unit]
Description=Proof of Access Node
After=network.target ipfs.service
Requires=ipfs.service

[Service]
Type=simple
WorkingDirectory=/home/${whoami_user}
ExecStart=/home/${whoami_user}/trole/node_modules/.bin/proofofaccess -node 2 -username ${ACCOUNT:-${whoami_user}} -WS_PORT=8000 -useWS=true -honeycomb=true -IPFS_PORT=5001
Restart=on-failure
RestartSec=5
User=${whoami_user}
Group=${whoami_user}
Environment=\"HOME=/home/${whoami_user}\"

[Install]
WantedBy=multi-user.target"
        
        echo "$poa_service" | sudo tee /lib/systemd/system/poa.service > /dev/null
        log INFO "Updated poa.service"
    fi
    
    # Update PoAV service if exists
    if [[ -f "/lib/systemd/system/poav.service" ]]; then
        log INFO "Updating poav.service..."
        
        local poav_service="[Unit]
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
Environment=\"HOME=/home/${whoami_user}\"

[Install]
WantedBy=multi-user.target"
        
        echo "$poav_service" | sudo tee /lib/systemd/system/poav.service > /dev/null
        log INFO "Updated poav.service"
    fi
    
    # Reload systemd
    sudo systemctl daemon-reload
    log INFO "Systemd configuration reloaded"
}

start_services() {
    log INFO "Starting updated services..."
    
    # Start PoA service
    if [[ -f "/lib/systemd/system/poa.service" ]]; then
        log INFO "Starting poa service..."
        if ! sudo systemctl start poa; then
            log ERROR "Failed to start poa service"
            log ERROR "Check logs with: sudo journalctl -u poa -n 50"
        else
            log INFO "poa service started successfully"
        fi
    fi
    
    # Start PoAV service if it was enabled
    if [[ -f "/lib/systemd/system/poav.service" ]]; then
        if sudo systemctl is-enabled --quiet poav; then
            log INFO "Starting poav service..."
            if ! sudo systemctl start poav; then
                log ERROR "Failed to start poav service"
                log ERROR "Check logs with: sudo journalctl -u poav -n 50"
            else
                log INFO "poav service started successfully"
            fi
        fi
    fi
}

cleanup_old_installation() {
    log INFO "Cleanup options for old installation..."
    
    echo
    echo -e "${YELLOW}Optional Cleanup:${NC}"
    echo "The following items can be safely removed if not needed:"
    echo
    
    # Old ProofOfAccess directory
    if [[ -d "${HOME}/proofofaccess" ]]; then
        echo "1. Old ProofOfAccess source and binary:"
        echo "   rm -rf ${HOME}/proofofaccess"
        echo
    fi
    
    # Go installation
    if command_exists go; then
        if [[ -f "/snap/bin/go" ]]; then
            echo "2. Go installation (if not needed for other projects):"
            echo "   sudo snap remove go"
            echo
        fi
    fi
    
    echo "These are optional - only remove if you're sure they're not needed."
    echo
}

verify_upgrade() {
    log INFO "Verifying upgrade..."
    
    local all_good=true
    
    # Check npm binary exists
    if [[ -f "${SCRIPT_DIR}/node_modules/.bin/proofofaccess" ]]; then
        log INFO "✓ ProofOfAccess npm binary found"
    else
        log ERROR "✗ ProofOfAccess npm binary not found"
        all_good=false
    fi
    
    # Check services
    if sudo systemctl is-active --quiet poa; then
        log INFO "✓ poa service is running"
    else
        log WARN "✗ poa service is not running"
        all_good=false
    fi
    
    if [[ "$all_good" == "true" ]]; then
        log INFO "Upgrade completed successfully!"
    else
        log WARN "Upgrade completed with some issues - please check the logs"
    fi
}

display_summary() {
    echo
    echo -e "${GREEN}=== UPGRADE SUMMARY ===${NC}"
    echo -e "${BLUE}What changed:${NC}"
    echo "  • ProofOfAccess now runs from: node_modules/.bin/proofofaccess"
    echo "  • No longer requires Go to build from source"
    echo "  • Updates managed through npm (npm update @disregardfiat/proofofaccess)"
    echo
    echo -e "${BLUE}Backup location:${NC} $BACKUP_DIR"
    echo
    echo -e "${BLUE}Service status:${NC}"
    
    for service in poa poav; do
        if [[ -f "/lib/systemd/system/${service}.service" ]]; then
            if sudo systemctl is-active --quiet "$service"; then
                echo -e "  ${GREEN}✓${NC} $service is running"
            else
                echo -e "  ${RED}✗${NC} $service is not running"
            fi
        fi
    done
    
    echo
    echo -e "${YELLOW}To check service logs:${NC}"
    echo "  sudo journalctl -u poa -f    # Follow poa logs"
    echo "  sudo journalctl -u poav -f   # Follow poav logs"
    echo
    echo -e "${YELLOW}To update ProofOfAccess in the future:${NC}"
    echo "  npm update @disregardfiat/proofofaccess"
    echo "  sudo systemctl restart poa poav"
    echo
}

# =============================================================================
# MAIN UPGRADE FLOW
# =============================================================================

main() {
    log INFO "Starting ProofOfAccess upgrade to npm-based binary..."
    log INFO "Log file: $LOG_FILE"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error_exit "Please run as regular user (not root)"
    fi
    
    # Source .env if exists for ACCOUNT variable
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        source "${SCRIPT_DIR}/.env"
    fi
    
    echo
    echo -e "${YELLOW}This script will upgrade your ProofOfAccess installation to use npm binaries.${NC}"
    echo -e "${YELLOW}A backup will be created before making changes.${NC}"
    echo
    read -p "Continue with upgrade? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log INFO "Upgrade cancelled by user"
        exit 0
    fi
    
    # Run upgrade steps
    check_existing_installation
    create_backup
    stop_services
    update_package_json
    install_npm_package
    update_service_files
    start_services
    verify_upgrade
    cleanup_old_installation
    display_summary
    
    log INFO "Upgrade process completed"
}

# =============================================================================
# SCRIPT EXECUTION
# =============================================================================

# Create log file and redirect stderr
exec 2> >(tee -a "$LOG_FILE")

# Handle script interruption
trap 'log ERROR "Upgrade interrupted by user"; exit 130' INT
trap 'log ERROR "Upgrade failed unexpectedly on line $LINENO"; exit 1' ERR

# Run main upgrade
main "$@"

exit 0