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

group=$(groups | grep $whoami)
if [ -z "$group" ];
then
    echo -e "${RED}User $whoami is not a part of the group $whoami. Add user to group and run this script again.${NC}"
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
echo -e "${YELLOW}This script may ask some questions after it installs it's first set of dependencies. Stay tuned.${NC}"

source .env
if [ -z "$DOMAIN" ];
then
    echo What is your domain name? -dlux.io
    read DOMAIN
    echo "DOMAIN=${DOMAIN}" | tee -a .env
else
    echo "DOMAIN=${DOMAIN}"
fi

sudo apt update &> /dev/null
echo -e "${YELLOW}Ensure ipfs.${DOMAIN} DNS records point to this server.${NC}"
echo "Install options:"
while true; do
    read -p "File Storage only?(No SPK Node and No Validator) " yn
    case $yn in
        [Yy]* ) BUILDSPK=false ; break;;
        [Nn]* ) BUILDSPK=true ; break;;
        * ) echo "Please answer yes or no.";;
    esac
done
if [ $BUILDSPK = "true" ];
then
    echo -e "${YELLOW}Ensure spk.${DOMAIN} DNS records point to this server.${NC}"
fi

while true; do
    read -p "Register a Validator? " yn
    case $yn in
        [Yy]* ) BUILDVAL=true ; break;;
        [Nn]* ) BUILDVAL=false ; break;;
        * ) echo "Please answer yes or no.";;
    esac
done
if [ $BUILDVAL = "true" ];
then
    echo -e "${YELLOW}Ensure poa.${DOMAIN} DNS records point to this server.${NC}"
fi
# install node

if ! command -v node > /dev/null
then
    curl -s https://deb.nodesource.com/setup_16.x | sudo bash
    sudo apt install nodejs -y
fi

if ! command -v npm > /dev/null
then
    sudo apt install npm -y
fi

# Install node for Trole

NODE_VERSION=$(node -v | cut -f1 -d.)
if [ ${NODE_VERSION/v} -lt 14 ];
then
    echo -e "${RED}NodeJS version 14 or higher is Required${NC}"
    echo -e "Ensure node -v is version 14 or higher and run this script again."
    exit
fi

# Install Trole

NODE_PACKAGES=node_modules
if test -d "$NODE_PACKAGES";
then
    echo -e "${GREEN}Trole is installed${NC}"
else
    echo -e "Installing Trole"
    npm i
fi

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

# hive account active key will be required as well

# Get configs
if test -f .env;
then
    echo -e "${GREEN}Reading .env Variables${NC}"
    source .env
    if [ -z "$DOMAIN" ];
    then
        echo What is your domain name? -dlux.io
        read DOMAIN
        echo "DOMAIN=spk.${DOMAIN}" | tee -a .env
    else
        echo "DOMAIN=spk.${DOMAIN}"
    fi
    if [ -z "$ACCOUNT" ];
    then
        echo What is your HIVE account name? dlux-io
        read ACCOUNT
        echo "ACCOUNT=${ACCOUNT}" | tee -a .env
    else
        echo "ACCOUNT=${ACCOUNT}"
    fi
    if [ -z "$ACTIVE" ];
    then
        echo "What is the ACTIVE key for $ACCOUNT"
        read ACTIVE
        echo "ACTIVE=${ACTIVE}" | tee -a .env
    else
        echo "ACTIVE=${ACTIVE}" | cut -b 1-10
    fi
    # For SPK Network Testnet
    echo "mirrorNet=true" | tee -a .env

    if [ -z "$SPKPRIV" ];
    then
        echo "Please input any existing SPK Keys, or generate a new keypair..."
        while true; do
            read -p "Do you have an existing SPK keypair? " yn
            case $yn in
                [Yy]* ) KEY_GEN=true ; break;;
                [Nn]* ) KEY_PROMPT=true ; break;;
                * ) echo "Please answer yes or no.";;
            esac
        done
    else
        KEY_PROMPT=false
        echo "SPKPUB=${SPKPUB}"
        echo "SPKPRIV=${SPKPRIV}" | cut -b 1-11
    fi
    if [ -z "$KEY_PROMPT" ];
        then
            echo "What is the Private SPK key for $ACCOUNT"
            read SPKPRIV
            echo "SPKPRIV=${SPKPRIV}" | tee -a .env 
            echo "What is the Public SPK key for $ACCOUNT"
            read SPKPUB
            echo "SPKPUB=${SPKPUB}" | tee -a .env
        elif [ $KEY_PROMPT = true ]
            then
                KEY_PAIR=$(node generate_key_pair.js)
                echo $KEY_PAIR
                SPKPRIV=$(echo $KEY_PAIR | cut -d " " -f1)
                SPKPUB=$(echo $KEY_PAIR | cut -d " " -f2)
                echo "SPKPRIV=${SPKPRIV}" | tee -a .env 
                echo "SPKPUB=${SPKPUB}" | tee -a .env
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
    if [ -z "$POA_URL" ];
    then
        echo "POA_URL=ws://localhost:8001" | tee -a .env 
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
    echo "VALIDATOR=${BUILDVAL}" | tee -a .env
    echo "ipfshost=127.0.0.1" | tee -a .env
    echo "ipfsprotocol=http" | tee -a .env
    echo "ipfsport=5001" | tee -a .env
    echo "STARTURL=https://rpc.ecency.com/" | tee -a .env
    echo "APIURL=https://rpc.ecency.com/" | tee -a .env
fi
source .env
echo -e "${YELLOW}Ensure ipfs.${DOMAIN} is pointed to this server${NC}"

# install ipfs
if ! command -v ipfs > /dev/null
then
    echo -e "${YELLOW}Installing IPFS(KUBO)${NC}"
    wget https://github.com/ipfs/kubo/releases/download/v0.26.0/kubo_v0.26.0_linux-amd64.tar.gz > /dev/null
    tar -xvzf kubo_v0.26.0_linux-amd64.tar.gz > /dev/null
    mv kubo ../kubo
    sudo bash ../kubo/install.sh > /dev/null
    rm kubo_v0.26.0_linux-amd64.tar.gz > /dev/null
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

IPFS_ID=$(ipfs id | grep ID | cut -d"\"" -f4 )
if [ -z "$IPFSID" ];
then
    echo "IPFSID=${IPFS_ID}" | tee -a .env 
elif [ $IPFS_ID != $IPFSID ];
then
    while true; do
        read -p "Your IPFS ID seems to have changed. Replace IPFSID in .env(Yes / No)?" yn
        case $yn in
            [Yy]* ) REPLACE=true ; break;;
            [Nn]* ) REPLACE=false ; break;;
            * ) echo "Please answer yes or no.";;
        esac
    done
    if [ $REPLACE = "true" ];
        then
        echo "IPFSID=${IPFS_ID}" | tee -a .env 
    fi
fi

IPFS_SERVICE_FILE=/lib/systemd/system/ipfs.service
if test -f "$IPFS_SERVICE_FILE";
then
    echo -e "${GREEN}IPFS service exists${NC}"
else
    echo -e "Building IPFS Service${NC}"
    echo -e IPFSSERVICE="[Unit]\nDescription=ipfs daemon\n[Service]\nExecStart=/usr/local/bin/ipfs daemon --enable-pubsub-experiment --enable-gc\nRestart=always\nUser=${whoami}\nGroup=${whoami}\nEnvironment=”IPFS_PATH=/home/${whoami}/data/ipfs”\n[Install]\nWantedBy=multi-user.target" | sudo tee $IPFS_SERVICE_FILE    
    sudo systemctl daemon-reload 
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

if [ $BUILDSPK = "true" ];
then
    SPK_SERVICE_FILE=/lib/systemd/system/spk.service
    if test -f "$SPK_SERVICE_FILE";
    then
        echo -e "${GREEN}SPK service exists${NC}"
    else
        git clone https://github.com/spknetwork/honeycomb-spkcc.git ~/honeycomb
        #install npm packages
        cd ~/honeycomb
        git checkout 1.2-poa
        npm i
        cp ~/trole/.env ~/honeycomb/.env
        # append spk to DOMAIN
        echo "DOMAIN=spk.${DOMAIN}" | tee -a .env
        echo -e "Installing HoneyComb"
        echo -e "[Unit]\nDescription=Spk Network Node\n[Service]\nWorkingDirectory=/home/${whoami}/honeycomb/\nExecStart=/usr/bin/node /home/${whoami}/honeycomb/index.js\nRestart=always\nUser=${whoami}\nGroup=${whoami}\n[Install]\nWantedBy=multi-user.target" | sudo tee $SPK_SERVICE_FILE
        sudo systemctl daemon-reload 
    fi

    spk_is_active=$(sudo systemctl is-active spk)
    if [ $spk_is_active = 'active' ];
    then
        echo -e "${GREEN}SPK is running${NC}"
    else
        echo 'Starting SPK'
        sudo systemctl start spk
    fi

    spk_is_enabled=$(sudo systemctl is-enabled spk)
    if [ $spk_is_enabled = 'enabled' ];
    then
        echo -e "${GREEN}SPK is set to auto-start${NC}"
    else
        echo 'Enabling SPK auto-start'
        sudo systemctl enable spk
    fi

    spk_is_active=$(sudo systemctl is-active spk)
    if [ $spk_is_active != 'active' ];
    then
        echo -e "${RED}SPK failed to start${NC}"
        exit
    else
        echo SPK is running
    fi
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
    echo -e "spk.${DOMAIN} {\n\treverse_proxy localhost:3001\n}\n\npoa.${DOMAIN} {\n\t@ws {\n\t\theader Connection *Upgrade*\n\t\theader Upgrade websocket\n\t}\n\treverse_proxy localhost:8001 \n\treverse_proxy @ws localhost:8001\n}\nipfs.${DOMAIN} {\n\t@ws {\n\t\theader Connection *Upgrade*\n\t\theader Upgrade websocket\n\t}\n\treverse_proxy /upload* localhost:${API_PORT} \n\t\treverse_proxy /ipfs/* localhost:8080\n\treverse_proxy @ws localhost:8001\n\t\tlog {\n\t\toutput file /var/log/caddy/ipfs.${DOMAIN}-access.log {\n\t\t\troll_size 10mb\n\t\t\troll_keep 20\n\t\t\troll_keep_for 720h\n\t\t}\n\t}\n}" | sudo tee -a $CADDY_FILE
    sudo systemctl restart caddy
else
    echo Caddy config exists: Ensure
    echo -e "spk.${DOMAIN} {\n\treverse_proxy localhost:3001\n}\n\npoa.${DOMAIN} {\n\t@ws {\n\t\theader Connection *Upgrade*\n\t\theader Upgrade websocket\n\t}\n\treverse_proxy localhost:8001 \n\treverse_proxy @ws localhost:8001\n}\nipfs.${DOMAIN} {\n\t@ws {\n\t\theader Connection *Upgrade*\n\t\theader Upgrade websocket\n\t}\n\treverse_proxy /upload* localhost:${API_PORT} \n\t\treverse_proxy /ipfs/* localhost:8080\n\treverse_proxy @ws localhost:8001\n\t\tlog {\n\t\toutput file /var/log/caddy/ipfs.${DOMAIN}-access.log {\n\t\t\troll_size 10mb\n\t\t\troll_keep 20\n\t\t\troll_keep_for 720h\n\t\t}\n\t}\n}"
    echo -e "${YELLOW}Ensure Caddyfile contains the above configuration${NC}"
fi

caddy_is_active=$(sudo systemctl is-active caddy)
if [ $caddy_is_active != 'active' ];
then
    echo -e "${RED}Caddy failed to start${NC}"
    exit
else
    echo -e "${GREEN}Caddy is running${NC}"
fi

TROLE_SERVICE_FILE=/lib/systemd/system/trole.service
if test -f "$TROLE_SERVICE_FILE";
then
    echo -e "${GREEN}Trole service exists${NC}"
else
    echo -e "Installing Trole"
    mkdir /home/${whoami}/trole/db
    echo -e TROLE_SERVICE="[Unit]\nDescription=trole\n[Service]\nWorkingDirectory=/home/${whoami}/trole\nExecStart=/usr/bin/node /home/${whoami}/trole/index.js\nRestart=always\nUser=${whoami}\nGroup=${whoami}\n[Install]\nWantedBy=multi-user.target" | sudo tee $TROLE_SERVICE_FILE
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


# PoA
which_go=$(which go)
if test -f "$which_go";
then
    echo -e "${GREEN}Go Installed${NC}"
else
    echo -e "Installing Go"
    which_snap=$(which snap)
    if test -f "$which_snap";
    then
        echo -e "${GREEN}Snap Installed${NC}"
    else
        echo -e "Installing Snap"
        
        sudo apt install snapd 
    fi
    sudo snap install go --classic 
fi

POA_SERVICE_FILE=/lib/systemd/system/poa.service
if test -f "$POA_SERVICE_FILE";
then
    echo -e "${GREEN}PoA service exists${NC}"
else
    git clone https://github.com/spknetwork/proofofaccess.git ~/proofofaccess
    cd ~/proofofaccess
    mkdir -p ~/data
    /snap/bin/go build -o ~/proofofaccess/main ~/proofofaccess/main.go
    #mv proofofaccess /home/${whoami}/proofofaccess
    #rm -rf proofofaccess
    echo -e "Installing Proof of Access"
    echo -e "[Unit]\nDescription=PoA\n[Service]\nWorkingDirectory=/home/${whoami}/\nExecStart=/home/${whoami}/proofofaccess/main -node 2 -username ${ACCOUNT} -WS_PORT=8000 -useWS=true -honeycomb=true -IPFS_PORT=5001\nRestart=always\nUser=${whoami}\nGroup=${whoami}\n[Install]\nWantedBy=multi-user.target" | sudo tee $POA_SERVICE_FILE
    sudo systemctl daemon-reload 
fi

poa_is_active=$(sudo systemctl is-active poa)
if [ $poa_is_active = 'active' ];
then
    echo -e "${GREEN}PoA is running${NC}"
else
    echo 'Starting PoA'
    sudo systemctl start poa
fi

poa_is_enabled=$(sudo systemctl is-enabled poa)
if [ $poa_is_enabled = 'enabled' ];
then
    echo -e "${GREEN}PoA is set to auto-start${NC}"
else
    echo 'Enabling PoA auto-start'
    sudo systemctl enable poa
fi

poa_is_active=$(sudo systemctl is-active poa)
if [ $poa_is_active != 'active' ];
then
    echo -e "${RED}PoA failed to start${NC}"
    exit
else
    echo PoA is running
fi

if [ $BUILDSPK = "true" ];
then

    POAV_SERVICE_FILE=/lib/systemd/system/poav.service
    if test -f "$POAV_SERVICE_FILE";
    then
        echo -e "${GREEN}PoA Validator service exists${NC}"
    else
        #git clone https://github.com/pknetwork/proofofaccess.git ~/proofofaccess
        #mv proofofaccess /home/${whoami}/proofofaccess
        #rm -rf proofofaccess
        #echo -e "Installing Proof of Access"
        echo -e "[Unit]\nDescription=PoA\n[Service]\nWorkingDirectory=/home/${whoami}/\nExecStart=/home/${whoami}/proofofaccess/main -node 1 -username validator1 -WS_PORT=8001 -useWS=true -honeycomb=true -IPFS_PORT=5001\nRestart=always\nUser=${whoami}\nGroup=${whoami}\n[Install]\nWantedBy=multi-user.target" | sudo tee $POAV_SERVICE_FILE
        sudo systemctl daemon-reload 
    fi
    
    poav_is_active=$(sudo systemctl is-active poav)
    if [ $poav_is_active = 'active' ];
    then
        echo -e "${GREEN}PoAV is running${NC}"
    else
        echo 'Starting PoAV'
        sudo systemctl start poav
    fi

    if [ $BUILDVAL = "true" ];
    then
        poav_is_enabled=$(sudo systemctl is-enabled poav)
        if [ $poav_is_enabled = 'enabled' ];
        then
            echo -e "${GREEN}PoAV is set to auto-start${NC}"
        else
            echo 'Enabling PoAV auto-start'
            sudo systemctl enable poav
        fi

        poav_is_active=$(sudo systemctl is-active poav)
        if [ $poav_is_active != 'active' ];
        then
            echo -e "${RED}PoAV failed to start${NC}"
            exit
        else
            echo PoAV is running
        fi
    fi
fi

echo -e "${GREEN}Registering Services${NC}"

cd ~/trole
node register_node.js

echo -e "${YELLOW}Ensure you have made a backup of your .env file. It contains your keys and can't be recovered if lost.${NC}"

exit
