#!/bin/bash
set -euo pipefail

# =============================================================================
# TROLE UPGRADE SCRIPT - Update all components to latest versions
# =============================================================================
# This script updates an existing Trole installation:
# - Git pull latest Trole code
# - Update npm packages (including ProofOfAccess)
# - Update SPK Network Node (HoneyComb) if installed
# - Update IPFS if needed
# - Restart all services
# =============================================================================

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly LOG_FILE="${SCRIPT_DIR}/upgrade_$(date +%Y%m%d_%H%M%S).log"
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
    log INFO "Creating backup of current configuration..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup .env file
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        cp "${SCRIPT_DIR}/.env" "$BACKUP_DIR/.env.bak"
        log INFO "Backed up .env file"
    fi
    
    # Backup package.json
    if [[ -f "${SCRIPT_DIR}/package.json" ]]; then
        cp "${SCRIPT_DIR}/package.json" "$BACKUP_DIR/package.json.bak"
        log INFO "Backed up package.json"
    fi
    
    # Backup service files
    local services=("ipfs" "trole" "spk" "poa" "poav")
    for service in "${services[@]}"; do
        local service_file="/lib/systemd/system/${service}.service"
        if [[ -f "$service_file" ]]; then
            sudo cp "$service_file" "$BACKUP_DIR/${service}.service.bak"
            log INFO "Backed up $service service file"
        fi
    done
    
    log INFO "Backup created at: $BACKUP_DIR"
}

# =============================================================================
# SERVICE MANAGEMENT
# =============================================================================

stop_services() {
    log INFO "Stopping services for upgrade..."
    
    local services=("trole" "spk" "poa" "poav")
    for service in "${services[@]}"; do
        if sudo systemctl is-active --quiet "$service"; then
            log INFO "Stopping $service..."
            sudo systemctl stop "$service"
        fi
    done
    
    # Give services time to shutdown cleanly
    sleep 3
}

start_services() {
    log INFO "Starting services..."
    
    # Start services in order
    local services=("ipfs" "trole")
    
    # Add optional services if they exist
    if [[ -f "/lib/systemd/system/spk.service" ]]; then
        services+=("spk")
    fi
    
    if [[ -f "/lib/systemd/system/poa.service" ]]; then
        services+=("poa")
    fi
    
    if [[ -f "/lib/systemd/system/poav.service" ]]; then
        if sudo systemctl is-enabled --quiet "poav"; then
            services+=("poav")
        fi
    fi
    
    for service in "${services[@]}"; do
        if [[ -f "/lib/systemd/system/${service}.service" ]]; then
            log INFO "Starting $service..."
            if ! sudo systemctl start "$service"; then
                log WARN "Failed to start $service - check logs with: sudo journalctl -u $service -n 50"
            else
                log INFO "$service started successfully"
            fi
        fi
    done
}

# =============================================================================
# UPGRADE FUNCTIONS
# =============================================================================

check_git_status() {
    log INFO "Checking git status..."
    
    cd "$SCRIPT_DIR"
    
    # Check if it's a git repository
    if [[ ! -d ".git" ]]; then
        log WARN "Not a git repository. Skipping git pull."
        return 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log WARN "Uncommitted changes detected in Trole directory"
        echo -e "${YELLOW}You have uncommitted changes. Please commit or stash them first.${NC}"
        echo "Changed files:"
        git status --short
        echo
        read -p "Continue anyway? (changes might be lost) (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error_exit "Upgrade cancelled due to uncommitted changes"
        fi
    fi
    
    return 0
}

upgrade_trole() {
    log INFO "Upgrading Trole..."
    
    cd "$SCRIPT_DIR"
    
    # Git pull if it's a git repo
    if check_git_status; then
        log INFO "Pulling latest Trole code..."
        local current_branch=$(git branch --show-current)
        log INFO "Current branch: $current_branch"
        
        if ! git pull origin "$current_branch"; then
            log ERROR "Git pull failed"
            log INFO "Trying to fetch and reset..."
            git fetch origin
            read -p "Reset to origin/$current_branch? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                git reset --hard "origin/$current_branch"
            else
                log WARN "Skipping git update"
            fi
        else
            log INFO "Trole code updated successfully"
        fi
    fi
    
    # Update npm packages
    log INFO "Updating npm packages..."
    
    # Clean install to ensure latest versions
    if [[ -f "package-lock.json" ]]; then
        log INFO "Removing package-lock.json for fresh dependency resolution..."
        rm package-lock.json
    fi
    
    if ! npm install; then
        error_exit "Failed to update npm packages"
    fi
    
    # Check if ProofOfAccess needs special handling
    if grep -q "@disregardfiat/proofofaccess" package.json; then
        log INFO "Updating ProofOfAccess to latest version..."
        npm update @disregardfiat/proofofaccess
        
        # Verify binary exists
        if [[ ! -f "node_modules/.bin/proofofaccess" ]]; then
            log WARN "ProofOfAccess binary not found, reinstalling..."
            npm install @disregardfiat/proofofaccess@latest
        fi
    fi
    
    log INFO "Trole upgrade completed"
}

upgrade_spk() {
    local spk_dir="${HOME}/honeycomb"
    
    if [[ ! -d "$spk_dir" ]]; then
        log INFO "SPK Network Node not installed, skipping..."
        return
    fi
    
    log INFO "Upgrading SPK Network Node (HoneyComb)..."
    
    cd "$spk_dir"
    
    # Check git status
    if [[ -d ".git" ]]; then
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            log WARN "Uncommitted changes in HoneyComb directory"
        fi
        
        log INFO "Pulling latest HoneyComb code..."
        local current_branch=$(git branch --show-current)
        
        if ! git pull origin "$current_branch"; then
            log WARN "Git pull failed for HoneyComb"
        else
            log INFO "HoneyComb code updated"
        fi
    fi
    
    # Update npm packages
    log INFO "Updating HoneyComb npm packages..."
    if [[ -f "package-lock.json" ]]; then
        rm package-lock.json
    fi
    
    if ! npm install; then
        log WARN "Failed to update HoneyComb npm packages"
    fi
    
    # Ensure .env is still present
    if [[ ! -f ".env" ]] && [[ -f "${SCRIPT_DIR}/.env" ]]; then
        log INFO "Restoring .env file for HoneyComb..."
        cp "${SCRIPT_DIR}/.env" ".env"
        
        # Update domain for SPK
        if grep -q "^DOMAIN=" .env; then
            source "${SCRIPT_DIR}/.env"
            sed -i "s/^DOMAIN=.*/DOMAIN=spk.${DOMAIN}/" .env
        fi
    fi
    
    cd "$SCRIPT_DIR"
    log INFO "SPK Network Node upgrade completed"
}

upgrade_proofofaccess() {
    local whoami_user=$(whoami)
    
    # Check which type of PoA installation exists
    if [[ -f "${HOME}/proofofaccess/main" ]]; then
        log INFO "Found Go-compiled ProofOfAccess installation"
        
        if command_exists go; then
            log INFO "Upgrading ProofOfAccess from source..."
            cd "${HOME}/proofofaccess"
            
            if [[ -d ".git" ]]; then
                git pull origin main || git pull origin master
                log INFO "Building ProofOfAccess..."
                go build -o main main.go || /snap/bin/go build -o main main.go
            fi
            cd "$SCRIPT_DIR"
        else
            log WARN "Go not installed, cannot rebuild ProofOfAccess from source"
            log INFO "Consider running upgrade-to-npm-poa.sh to switch to npm-based installation"
        fi
    elif [[ -f "${SCRIPT_DIR}/node_modules/.bin/proofofaccess" ]]; then
        log INFO "ProofOfAccess is managed via npm (already updated with npm install)"
    else
        log WARN "ProofOfAccess installation not found"
    fi
}

upgrade_ipfs() {
    if ! command_exists ipfs; then
        log WARN "IPFS not installed, skipping..."
        return
    fi
    
    local current_version=$(ipfs version --number)
    log INFO "Current IPFS version: $current_version"
    
    # Check for newer version (optional - just informational)
    log INFO "Checking for IPFS updates..."
    local latest_version=$(curl -s https://api.github.com/repos/ipfs/kubo/releases/latest | grep -oP '"tag_name": "\K[^"]+' || echo "")
    
    if [[ -n "$latest_version" ]]; then
        log INFO "Latest IPFS version available: $latest_version"
        if [[ "$latest_version" != "v$current_version" ]]; then
            echo -e "${YELLOW}New IPFS version available: $latest_version (current: v$current_version)${NC}"
            echo "To upgrade IPFS manually:"
            echo "  wget https://github.com/ipfs/kubo/releases/download/${latest_version}/kubo_${latest_version}_linux-amd64.tar.gz"
            echo "  tar -xvzf kubo_${latest_version}_linux-amd64.tar.gz"
            echo "  sudo bash kubo/install.sh"
        else
            log INFO "IPFS is up to date"
        fi
    fi
}

update_env_file() {
    log INFO "Checking .env file for missing variables..."
    
    local env_file="${SCRIPT_DIR}/.env"
    if [[ ! -f "$env_file" ]]; then
        log WARN ".env file not found"
        return
    fi
    
    source "$env_file"
    
    # Add any new required variables that might have been added in updates
    local whoami_user=$(whoami)
    
    # Check for UPLOAD_DIR
    if ! grep -q "^UPLOAD_DIR=" "$env_file"; then
        echo "UPLOAD_DIR=/home/${whoami_user}/trole/uploads" >> "$env_file"
        log INFO "Added UPLOAD_DIR to .env"
    fi
    
    # Ensure uploads directory exists with correct permissions
    local uploads_dir="/home/${whoami_user}/trole/uploads"
    if [[ ! -d "$uploads_dir" ]]; then
        mkdir -p "$uploads_dir"
        chmod 755 "$uploads_dir"
        log INFO "Created uploads directory"
    fi
}

verify_upgrade() {
    log INFO "Verifying upgrade..."
    
    local all_good=true
    
    # Check services status
    local services=("ipfs" "trole")
    
    if [[ -f "/lib/systemd/system/spk.service" ]]; then
        services+=("spk")
    fi
    
    if [[ -f "/lib/systemd/system/poa.service" ]]; then
        services+=("poa")
    fi
    
    for service in "${services[@]}"; do
        if sudo systemctl is-active --quiet "$service"; then
            log INFO "✓ $service is running"
        else
            log WARN "✗ $service is not running"
            all_good=false
        fi
    done
    
    # Check if npm packages are installed
    if [[ -d "${SCRIPT_DIR}/node_modules" ]]; then
        log INFO "✓ Node modules installed"
    else
        log ERROR "✗ Node modules not found"
        all_good=false
    fi
    
    if [[ "$all_good" == "true" ]]; then
        log INFO "All checks passed!"
    else
        log WARN "Some services may need attention"
    fi
}

display_summary() {
    echo
    echo -e "${GREEN}=== UPGRADE SUMMARY ===${NC}"
    echo -e "${BLUE}Log file:${NC} $LOG_FILE"
    echo -e "${BLUE}Backup location:${NC} $BACKUP_DIR"
    echo
    echo -e "${BLUE}Components upgraded:${NC}"
    echo "  • Trole core application"
    echo "  • Node.js dependencies"
    
    if [[ -d "${HOME}/honeycomb" ]]; then
        echo "  • SPK Network Node (HoneyComb)"
    fi
    
    if grep -q "@disregardfiat/proofofaccess" "${SCRIPT_DIR}/package.json" 2>/dev/null; then
        echo "  • ProofOfAccess (via npm)"
    elif [[ -f "${HOME}/proofofaccess/main" ]]; then
        echo "  • ProofOfAccess (from source)"
    fi
    
    echo
    echo -e "${BLUE}Service status:${NC}"
    
    for service in ipfs trole spk poa poav; do
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
    echo "  sudo journalctl -u trole -f    # Follow trole logs"
    echo "  sudo journalctl -u poa -f      # Follow poa logs"
    echo "  sudo journalctl -u spk -f      # Follow spk logs"
    echo
    echo -e "${YELLOW}To manually restart services:${NC}"
    echo "  sudo systemctl restart trole"
    echo "  sudo systemctl restart poa poav"
    echo "  sudo systemctl restart spk"
    echo
}

# =============================================================================
# MAIN UPGRADE FLOW
# =============================================================================

main() {
    log INFO "Starting Trole system upgrade..."
    log INFO "Log file: $LOG_FILE"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error_exit "Please run as regular user (not root)"
    fi
    
    # Check if we're in Trole directory
    if [[ ! -f "${SCRIPT_DIR}/package.json" ]] || [[ ! -f "${SCRIPT_DIR}/index.js" ]]; then
        error_exit "This script must be run from the Trole directory"
    fi
    
    echo
    echo -e "${YELLOW}This script will upgrade your Trole installation to the latest version.${NC}"
    echo -e "${YELLOW}A backup will be created before making changes.${NC}"
    echo
    echo "The following will be updated:"
    echo "  • Trole application (git pull)"
    echo "  • Node.js packages (npm install/update)"
    echo "  • SPK Network Node (if installed)"
    echo "  • ProofOfAccess (if installed)"
    echo
    read -p "Continue with upgrade? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log INFO "Upgrade cancelled by user"
        exit 0
    fi
    
    # Run upgrade steps
    create_backup
    stop_services
    upgrade_trole
    upgrade_spk
    upgrade_proofofaccess
    upgrade_ipfs
    update_env_file
    
    # Reload systemd in case service files changed
    sudo systemctl daemon-reload
    
    start_services
    verify_upgrade
    display_summary
    
    log INFO "Upgrade completed!"
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