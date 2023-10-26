# Trole

Trolls control the bridges. Trole does that based on hive role.

Trole is a reverse proxy that verifies a structed message is signed by a valid Hive `posting` or `active` key before bridging to a service. 

Trole uses no secrets. It verifies a valid message was signed.

This implemtation of Trole controls upload access to decentralized IPFS nodes on the SPK Network and a few other things. It has an install script that will help you install all compoent software of SPK Network based on your account. 

## Setup

Place between your IPFS gateway and the internet.

### Simple Full

Requires:
* non-root account on Debian/Ubuntu(20.04 or higher) with snap support.
* a domain name pointed to this server

Clone Repo:

`git clone https://github.com/spknetwork/trole`

Change Directory `cd trole`

Run Install Script `./install.sh`

Follow instructions

### Standalone

For SPK Network testing the simple full is the only officially supported install. But any contributions you'd like to make in documentation or testing are always welcome.

### Feedback

Feel free to use Github's feedback mechanisms or join our discord https://discord.gg/JbhQ7dREsP