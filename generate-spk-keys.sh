#!/bin/bash
set -euo pipefail

# =============================================================================
# SPK KEY GENERATION HELPER SCRIPT
# =============================================================================
# This script helps generate SPK keys for users who need them after installation
# or want to regenerate them separately
# =============================================================================

# Color codes for output formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[0;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Node.js is not installed"
    echo "Please install Node.js first or run the main installation script"
    exit 1
fi

# Check if generate_key_pair.js exists
if [[ ! -f "generate_key_pair.js" ]]; then
    echo -e "${RED}[ERROR]${NC} generate_key_pair.js not found"
    echo "Please run this script from the Trole directory"
    exit 1
fi

echo -e "${BLUE}=== SPK Key Generator ===${NC}"
echo
echo "This script will generate a new SPK keypair for your node."
echo

# Generate keys
echo -e "${YELLOW}Generating new SPK keypair...${NC}"
KEY_PAIR=$(node generate_key_pair.js)

if [[ -z "$KEY_PAIR" ]]; then
    echo -e "${RED}[ERROR]${NC} Failed to generate keys"
    exit 1
fi

SPKPRIV=$(echo "$KEY_PAIR" | cut -d " " -f1)
SPKPUB=$(echo "$KEY_PAIR" | cut -d " " -f2)

echo
echo -e "${GREEN}Successfully generated SPK keypair!${NC}"
echo
echo -e "${BLUE}Your SPK Keys:${NC}"
echo -e "${YELLOW}Private Key:${NC} $SPKPRIV"
echo -e "${YELLOW}Public Key:${NC}  $SPKPUB"
echo
echo -e "${RED}IMPORTANT:${NC}"
echo "1. Save these keys securely - they cannot be recovered if lost"
echo "2. Never share your private key with anyone"
echo "3. Add these keys to your .env file:"
echo
echo "   SPKPRIV=${SPKPRIV}"
echo "   SPKPUB=${SPKPUB}"
echo "   msowner=${SPKPRIV}"
echo "   mspublic=${SPKPUB}"
echo

# Ask if user wants to update .env
if [[ -f ".env" ]]; then
    read -p "Update .env file with these keys? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Backup existing .env
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        
        # Update or add keys
        if grep -q "^SPKPRIV=" .env; then
            sed -i "s/^SPKPRIV=.*/SPKPRIV=${SPKPRIV}/" .env
        else
            echo "SPKPRIV=${SPKPRIV}" >> .env
        fi
        
        if grep -q "^SPKPUB=" .env; then
            sed -i "s/^SPKPUB=.*/SPKPUB=${SPKPUB}/" .env
        else
            echo "SPKPUB=${SPKPUB}" >> .env
        fi
        
        if grep -q "^msowner=" .env; then
            sed -i "s/^msowner=.*/msowner=${SPKPRIV}/" .env
        else
            echo "msowner=${SPKPRIV}" >> .env
        fi
        
        if grep -q "^mspublic=" .env; then
            sed -i "s/^mspublic=.*/mspublic=${SPKPUB}/" .env
        else
            echo "mspublic=${SPKPUB}" >> .env
        fi
        
        echo -e "${GREEN}✓${NC} Updated .env file with new keys"
        echo -e "${BLUE}Backup saved to:${NC} .env.backup.$(date +%Y%m%d_%H%M%S)"
    fi
fi

echo
echo -e "${GREEN}Done!${NC}"