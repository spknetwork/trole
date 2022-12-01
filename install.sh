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

# pg_is_active=$(sudo systemctl is-active postgres)
# if [ $pg_is_active = 'active' ];
# then
#     echo Postgres is running
# else

#     sudo apt install libreadline-dev zlib1g-dev -y

#     STARTDIR=$(pwd)
#     BUILDDIR=/tmp/$USER-pg-build
#     INSTALLDIR=$HOME/pgsql
#     PGVERSION=12.5
#     SOURCEPKG=postgresql-$PGVERSION.tar.bz2
#     CONFIGUREOPTIONS="--with-openssl"

#     # define PROFILEFILE

#     SHELLNAME=$(basename "$SHELL")
#     if [ "x$2" != "x" ]; then
#     PROFILEFILE=$HOME/$2
#     touch "$PROFILEFILE"
#     # for example: .bash_profile, .profile or I_want_to_see_what_would_be_added
#     echo "Using $2 to save environment variables."
#     elif [ "$SHELLNAME" = "bash" ]; then
#     PROFILEFILE=$HOME/.bashrc
#     echo "You are currently using bash as your shell, so defaulting to .bashrc for environment variables."
#     elif [ "$SHELLNAME" = "zsh" ]; then
#     PROFILEFILE=$HOME/.zshrc
#     echo "You are currently using zsh as your shell, so defaulting to .zshrc for environment variables."
#     elif [ "$SHELLNAME" = "csh" ] || [ "$SHELLNAME" = "tcsh" ]; then
#     PROFILEFILE=$HOME/pg-shellvariables
#     echo "This script does not automatically add variables with csh syntax to your shell configuration."
#     echo "Please add manually variables from $PROFILEFILE to your .cshrc using csh syntax."
#     else
#     PROFILEFILE=$HOME/.shrc
#     echo "Defaulting to .shrc for environment variables, if this is incorrect, please copy these manually to correct file."
#     fi

#     echo "
#     Building in $BUILDDIR
#     Installing to $INSTALLDIR
#     Adding environment variables to $PROFILEFILE
#     Build should take about 5 minutes."
#     sleep 5

#     mkdir -p "$BUILDDIR"
#     cd /tmp || exit
#     curl -O https://ftp.postgresql.org/pub/source/v$PGVERSION/$SOURCEPKG
#     PGFILE=$(realpath $SOURCEPKG)
#     cd "$BUILDDIR" || exit

#     SOURCEDIR=$(basename "$PGFILE" .tar.bz2)

#     tar -xjf "$PGFILE"
#     cd "$SOURCEDIR" || exit
#     ./configure --prefix="$INSTALLDIR" $CONFIGUREOPTIONS
#     echo $?
#     if [ $? -gt 0 ];
#     then
#     exit 1
#     fi
#     make
#     if [ $? -gt 0 ];
#     then
#     exit 1
#     fi
#     make install-strip
#     if [ $? -gt 0 ];
#     then
#     exit 1
#     fi

#     # update profile file
#     env_vars="export LD_LIBRARY_PATH=$INSTALLDIR/lib
#     export PATH=$INSTALLDIR/bin:\$PATH
#     export PGHOST=$INSTALLDIR/sock
#     export PGDATA=$INSTALLDIR/data"

#     if [ -f "$PROFILEFILE" ]; then
#     if grep -q "$INSTALLDIR" "$PROFILEFILE" 2>/dev/null; then
#     echo "
#     $PROFILEFILE not updated, $INSTALLDIR is already mentioned there, so assuming this is reinstall and it is up to date.
#     "
#     else
#     echo "$env_vars" >> "$PROFILEFILE"
#     echo "
#     Added environment variables to $PROFILEFILE
#     "
#     fi
#     else
#     echo "$PROFILEFILE does not exist!"
#     echo "
#     Added environment variables to $INSTALLDIR/README.environment, copy these manually to correct location.
#     "
#     fi

#     echo "$env_vars" >> "$INSTALLDIR/README.environment"

#     # modify default config to use only sockets

#     mv "$INSTALLDIR/share/postgresql.conf.sample" "$INSTALLDIR/share/postgresql.conf.sample.orig"
#     sed -e "s|#listen_addresses = 'localhost'|listen_addresses = ''|" \
#     -e "s|#unix_socket_directories = '/tmp'|unix_socket_directories = '$INSTALLDIR/sock'|" \
#     -e 's|#unix_socket_permissions = 0777|unix_socket_permissions = 0700|' \
#     < "$INSTALLDIR/share/postgresql.conf.sample.orig" > "$INSTALLDIR/share/postgresql.conf.sample"

#     mkdir "$INSTALLDIR/sock"
#     chmod 0700 "$INSTALLDIR/sock"

#     # move to where we started and clean up

#     cd "$STARTDIR" || exit
#     rm -R "$BUILDDIR"

#     # initdb and createdb

#     echo "Creating database, please wait."

#     "$INSTALLDIR/bin/initdb" --auth-local=trust --auth-host=reject -D "$INSTALLDIR/data" > /dev/null
#     "$INSTALLDIR/bin/pg_ctl" -s -D "$INSTALLDIR/data" -l "$INSTALLDIR/createdb-logfile" start
#     "$INSTALLDIR/bin/createdb" -h "$INSTALLDIR/sock" "$USER"
#     "$INSTALLDIR/bin/pg_ctl" -s -D "$INSTALLDIR/data" stop

#     echo "
#     ******
#     You may need to start new terminal (or relogin) for environment variables 
#     to update.
#     When it is running, you can connect to database in different terminal with 
#     command:
#         psql
#     When you need to connect to database from code, use socket in 
#     $INSTALLDIR/sock 
#     with default database name and no need to give username or password. Please 
#     do not hardcode this into your code, this connection will only work for you.
#     ******"

#     # create file with variables

#     echo "
#     data directory (PGDATA): $INSTALLDIR/data
#     socket directory (PGHOST): $INSTALLDIR/sock
#     database name: $USER
#     " > "$INSTALLDIR/README.variables"

#     PG_SERVICE_FILE=/lib/systemd/system/postgres.service
#     if test -f "$PG_SERVICE_FILE";
#     then
#         echo -e "${GREEN}Postgres service exists${NC}"
#     else
#         echo -e "Installing Postgres Service"
#         echo -e PG_SERVICE="[Unit]\nDescription=postgres\n[Service]\nExecStart=/home/${whoami}/pgsql/bin/pg_ctl start -D /home/${whoami}/pgsql/data\nExecStop=/home/${whoami}/pgsql/bin/pg_ctl stop\nRestart=always\nUser=${whoami}\nGroup=${whoami}\n[Install]\nWantedBy=multi-user.target" | sudo tee $PG_SERVICE_FILE
#         sudo systemctl daemon-reload 
#     fi

#     pg_is_active=$(sudo systemctl is-active postgres)
#     if [ $pg_is_active = 'active' ];
#     then
#         echo -e "${GREEN}Postgres is running${NC}"
#     else
#         echo 'Starting Postgres'
#         sudo systemctl start postgres
#     fi

#     pg_is_enabled=$(sudo systemctl is-enabled postgres)
#     if [ $pg_is_enabled = 'enabled' ];
#     then
#         echo -e "${GREEN}Postgres is set to auto-start${NC}"
#     else
#         echo 'Enabling Postgres auto-start'
#         sudo systemctl enable postgres
#     fi

#     pg_is_active=$(sudo systemctl is-active postgres)
#     if [ $pg_is_active != 'active' ];
#     then
#         echo -e "${RED}Postgres failed to start${NC}"
#         exit
#     else
#         echo Postgres is running
#     fi
# fi
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

# Uninstall Directions
echo "
<<Uninstall:
1) If you want to save your postgress database contents, move $INSTALLDIR/data
   out of $INSTALLDIR.
2) Delete entire $INSTALLDIR.
3) Remove lines mentioning pgsql with LD_LIBRARY_PATH, PATH, PGHOST and
   PGDATA at or near the end of your $PROFILEFILE 
   (or where ever you have added them manually)
Uninstall
INSTALLDIR=$INSTALLDIR
PROFILEFILE=$PROFILEFILE
" > "README.uninstall"
exit