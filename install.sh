#!/bin/bash

# Formatting STDOUT
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

whoami=$(whoami)
if [ $whoami = root ];
then
    echo -e "${RED}Can not install as root${NC}"
    exit
fi

# version check
source /etc/os-release
if [ $ID_LIKE != 'debian' ];
then
    echo -e "${RED}${PRETTY_NAME}${NC} Installed"
    echo -e "${RED}Ubuntu/Debian Required for Install Script${NC}"
    exit
fi

sudo apt update &> /dev/null

# if ! command -v docker > /dev/null
# then
#     echo Installing Docker
#     sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
#     curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
#     sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu focal stable" -y
#     apt-cache policy docker-ce
#     sudo apt install docker-ce -y
# else
#     echo -e "${GREEN}Docker installed${NC}"
# fi

# if ! command -v docker-compose > /dev/null
# then
#     echo Installing Docker Compose
#     sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
#     sudo chmod +x /usr/local/bin/docker-compose
# else
#     echo -e "${GREEN}Docker-Compose installed${NC}"
# fi

# Get configs
if test -f .env;
then
    echo -e "${GREEN}Reading .env Variables${NC}"
    source .env
    if [ -z "$DOMAIN" ];
    then
        echo What is your domain name? -dlux.io
        read DOMAIN
        echo "DOMAIN=${DOMAIN}" | tee -a .env 
    fi
    if [ -z "$ACCOUNT" ];
    then
        echo What is your HIVE account name? dlux-io
        read ACCOUNT
        echo "ACCOUNT=${ACCOUNT}" | tee -a .env 
    fi
    if [ -z "$API_PORT" ];
    then
        echo "API_PORT=5050" | tee -a .env 
    fi
    if [ -z "$ENDPORT" ];
    then
        echo "ENDPORT=5001" | tee -a .env 
    fi
    if [ -z "$ENDPOINT" ];
    then
        echo "ENDPOINT=http://127.0.0.1" | tee -a .env 
    fi
else
    echo -e "${YELLOW}No .env found${NC}"
    echo What is your domain name? -dlux.io
    read DOMAIN
    echo "DOMAIN=${DOMAIN}" | tee -a .env 
    echo What is your HIVE account name? dlux-io
    read ACCOUNT
    echo "ACCOUNT=${ACCOUNT}" | tee -a .env
    echo "API_PORT=5050" | tee -a .env 
    echo "ENDPOINT=http://127.0.0.1" | tee -a .env 
    echo "ENDPORT=5001" | tee -a .env 

fi
source .env
echo -e "${YELLOW}Ensure ipfs.${DOMAIN} is pointed to this server${NC}"

# install ipfs
if ! command -v ipfs > /dev/null
then
    echo -e "${YELLOW}Installing IPFS(KUBO)${NC}"
    wget https://dist.ipfs.tech/kubo/v0.17.0/kubo_v0.17.0_linux-amd64.tar.gz > /dev/null
    tar -xvzf kubo_v0.17.0_linux-amd64.tar.gz > /dev/null
    mv kubo ../kubo
    sudo bash ../kubo/install.sh > /dev/null
    rm kubo_v0.17.0_linux-amd64.tar.gz > /dev/null
    # if ! command -v ipfs > /dev/null
    # then
    #     echo -e "${GREEN} IPFS installed succesfully${NC}"
    # else
    #     echo -e "${RED} IPFS install failed${NC}"
    #     echo -e "${YELLOW}Try Installing IPFS manually and run this script again${NC}"
    #     exit
    # fi
else
    echo -e "${GREEN}IPFS is installed${NC}"
fi
IPFS_CONFIG_FILE=~/.ipfs/config
if test -f "$IPFS_CONFIG_FILE";
then
    echo -e "${GREEN}IPFS config exists${NC}"
else
    echo -e "${GREEN}Initializing IPFS${NC}"
    ipfs init --profile server > /dev/null
fi

echo 'Configuring IPFS cors'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'
ipfs config --json API.HTTPHeaders.Access-Control-Expose-Headers '["Location"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'

IPFS_SERVICE_FILE=/lib/systemd/system/ipfs.service
if test -f "$IPFS_SERVICE_FILE";
then
    echo -e "${GREEN}IPFS service exists${NC}"
else
    echo -e "Building IPFS Service${NC}"
    echo -e IPFSSERVICE="[Unit]\nDescription=ipfs daemon\n[Service]\nExecStart=/usr/local/bin/ipfs daemon\nRestart=always\nUser=${whoami}\nGroup=${whoami}\nEnvironment=”IPFS_PATH=/home/${whoami}/data/ipfs”\n[Install]\nWantedBy=multi-user.target" | sudo tee $IPFS_SERVICE_FILE    
fi

ipfs_is_active=$(sudo systemctl is-active ipfs)
if [ $ipfs_is_active = 'active' ];
then
    echo -e "${GREEN}IPFS daemon is active${NC}"
else
    echo 'Starting IPFS daemon'
    sudo systemctl start ipfs
fi

ipfs_is_enabled=$(sudo systemctl is-enabled ipfs)
if [ $ipfs_is_enabled = 'enabled' ];
then
    echo -e "${GREEN}IPFS service is set to auto-start${NC}"
else
    echo 'Enabling IPFS daemon auto-start'
    sudo systemctl enable ipfs
fi

ipfs_is_active=$(sudo systemctl is-active ipfs)
if [ $ipfs_is_active != 'active' ];
then
    echo -e "${RED}IPFS failed to start${NC}"
    exit
fi

# install caddy
CADDY_FILE=/etc/caddy/Caddyfile
if ! command -v caddy > /dev/null
then
    echo -e "${YELLOW}Installing Caddy${NC}"
    sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt update > /dev/null
    sudo apt install caddy > /dev/null
else
    echo -e "${GREEN}Caddy is installed${NC}"
fi

CADDY_PATTERN="ipfs.${DOMAIN}"
CADDY_CONFIG_EXISTS=$(grep $CADDY_PATTERN $CADDY_FILE 2> /dev/null)
if [ -z "$CADDY_CONFIG_EXISTS" ];
then
    echo Building Caddyfile
    echo -e "ipfs.${DOMAIN} {\n\treverse_proxy /api/* localhost:${API_PORT} {\n\t\t\theader_down Access-Control-Allow-Origin *\n\t\t\theader_down Access-Control-Allow-Methods ”POST”\n\t\t\theader_down Access-Control-Allow-Headers *\n\t\t}\n\t\treverse_proxy /ipfs/* localhost:8080\n\t\tlog {\n\t\toutput file /var/log/caddy/ipfs.${DOMAIN}-access.log {\n\t\t\troll_size 10mb\n\t\t\troll_keep 20\n\t\t\troll_keep_for 720h\n\t\t}\n\t}\n}" | sudo tee -a $CADDY_FILE
    sudo systemctl restart caddy
else
    echo Caddy is configured
fi

caddy_is_active=$(sudo systemctl is-active caddy)
if [ $caddy_is_active != 'active' ];
then
    echo -e "${RED}Caddy failed to start${NC}"
    exit
else
    echo -e "${GREEN}Caddy is running${NC}"
fi

if ! command -v node > /dev/null
then
    curl -s https://deb.nodesource.com/setup_16.x | sudo bash
    sudo apt install nodejs -y
fi

if ! command -v npm > /dev/null
then
    sudo apt install npm -y
fi

# Install node for Trol

NODE_VERSION=$(node -v | cut -f1 -d.)
if [ ${NODE_VERSION/v} -lt 14 ];
then
    echo -e "${RED}NodeJS version 14 or higher is Required${NC}"
    echo -e "Ensure node -v is version 14 or higher and run this script again."
    exit
fi

# Install Postgres

# Install Trole

NODE_PACKAGES=node_modules
if test -d "$NODE_PACKAGES";
then
    echo -e "${GREEN}Trole is installed${NC}"
else
    echo -e "Installing Trole"
    npm i
fi

TROLE_SERVICE_FILE=/lib/systemd/system/trole.service
if test -f "$TROLE_SERVICE_FILE";
then
    echo -e "${GREEN}Trole service exists${NC}"
else
    echo -e "Installing Trole"
    echo -e TROLE_SERVICE="[Unit]\nDescription=trole\n[Service]\nExecStart=/usr/bin/node /home/${whoami}/trole/index.js\nRestart=always\nUser=${whoami}\nGroup=${whoami}\n[Install]\nWantedBy=multi-user.target" | sudo tee $TROLE_SERVICE_FILE
    sudo systemctl daemon-reload 
fi

trole_is_active=$(sudo systemctl is-active trole)
if [ $trole_is_active = 'active' ];
then
    echo -e "${GREEN}Trole is running${NC}"
else
    echo 'Starting Trole'
    sudo systemctl start trole
fi

trole_is_enabled=$(sudo systemctl is-enabled trole)
if [ $trole_is_enabled = 'enabled' ];
then
    echo -e "${GREEN}Trole is set to auto-start${NC}"
else
    echo 'Enabling Trole auto-start'
    sudo systemctl enable trole
fi

trole_is_active=$(sudo systemctl is-active trole)
if [ $trole_is_active != 'active' ];
then
    echo -e "${RED}Trole failed to start${NC}"
    exit
else
    echo Trole is running
fi

# install spk node?
exit