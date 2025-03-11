# Trole

Trolls control the bridges. Trole does that based on hive role.

Trole is a reverse proxy that verifies a structed message is signed by a valid Hive `posting` or `active` key before bridging to a service. 

This implemtation of Trole controls upload access to decentralized IPFS nodes on the SPK Network and a few other things. It has an install script that will help you install all compoent software of SPK Network based on your account. 

## Setup

Place between your IPFS gateway and the internet.

### Simple SPK Storage Node

You'll need Docker - [Get Docker](https://docs.docker.com/get-docker/)

Next, copy `env.sample` to `.env` and write your spknetwork hive account and active key in the coppied file.

Now run the build and up

`docker-compose build`

`docker-compose up -d`

If you make any changes ensure you run `docker-compose down` before `up` to reset the IPFS healthchecks.

Some Users have had issues with the docker network with the above configuration. They have had success with `docker-host.yml` which you can run with the following command.
 * `docker-compose build -f docker-host.yml`
 * `docker-compose up -d -f docker-host.yml`

 You can view the status of your containers with the following
  * `docker-compose logs -f --tail="200"`
    * -f => follow (live view)
    * --tail="History Lines" with out this it will show everything in the current cycle, may overwhelm.

More documentation will follow. Follow spknetwork, disregardfiat, and nathansenn on hive.

### Simple Full

Requires:
* non-root account on Debian/Ubuntu(20.04 or higher) with snap support.
* a domain name pointed to this server

Clone Repo:

`git clone https://github.com/spknetwork/trole`

Change Directory `cd trole`

Next, copy `env.sample` to `.env` and write your spknetwork hive account and active key in the coppied file.

Run Install Script `./install.sh`

Follow instructions

### Standalone

For SPK Network testing the simple full is the only officially supported install. But any contributions you'd like to make in documentation or testing are always welcome.

## API Documentation

Endpoints
### Upload File Chunk
* Endpoint: POST /upload
* Purpose: Uploads a file chunk to the server.
* Headers:
  * x-contract: The contract ID.
  * content-range: The range of the chunk being uploaded (e.g., bytes=0-999/10000).
  * x-cid: The CID of the file.
  * Body: The file chunk.
* Response:
  * 200 OK: Success.
  * 400 Bad Request: Missing headers or invalid format.
  * 401 Unauthorized: No file with such credentials.
  * 402 Payment Required: Invalid Content-Range.
  * 403 Forbidden: Bad chunk provided.
  * 405 Method Not Allowed: Missing Content-Range header.
  * 406 Not Acceptable: Missing x-contract header.
  * 500 Internal Server Error: Internal error.
### Create Upload Contract
* Endpoint: GET /upload-contract
* Purpose: Creates a new contract for the user.
* Query Parameters:
  * user: The username.
* Response:
  * 200 OK: Contract sent successfully.
  * 400 Bad Request: Contract exists or user pubKey not found.
### Check Upload Status
* Endpoint: GET /upload-check
* Purpose: Checks the upload status of a file.
* Headers:
  * x-cid: The CID of the file.
  * x-files: The list of CIDs.
  * x-account: The account name.
  * x-sig: The signature.
  * x-contract: The contract ID.
* Response:
  * 200 OK: Total chunk uploaded.
  * 400 Bad Request: Missing data or storage mismatch.
  * 401 Unauthorized: Access denied.
### Authorize Upload
 Endpoint: GET /upload-authorize
* Purpose: Authorizes the upload of files.
* Headers:
  * x-cid: The CID.
  * x-files: The list of CIDs.
  * x-account: The account name.
  * x-sig: The signature.
  * x-contract: The contract ID.
  * x-meta: The metadata.
* Response:
  * 200 OK: Authorized CIDs.
  * 400 Bad Request: Missing data.
  * 401 Unauthorized: Access denied.
### Get Live Statistics
* Endpoint: GET /upload-stats
* Purpose: Provides live statistics of the node.
* Response:
  * 200 OK: JSON object with IPFS ID, pubKey, head block, node, API, storage max, repo size, and number of objects.
### Check Flag Status
* Endpoint: GET /flag-qry/:cid
* Purpose: Checks if a CID is flagged.
* Path Parameters:
  * cid: The CID to check.
* Response:
  * 200 OK: JSON object with flag set to true or false.
### Flag or Unflag CID
* Endpoint: GET /flag
* Purpose: Flags or unflags a CID.
* Query Parameters:
  * cid: The CID to flag/unflag.
  * sig: The signature.
  * unflag: Optional, set to true to unflag.
* Response:
  * 200 OK: JSON object with a message indicating the flag status.
### Get All Contracts
* Endpoint: GET /contracts
* Purpose: Retrieves all active contracts.
* Response:
  * 200 OK: JSON object with an array of contracts.
### Get Storage Statistics
* Endpoint: GET /storage-stats
* Purpose: Provides storage statistics.
* Response:
  * 200 OK: JSON object with disk usage, IPFS repo stats, and active contracts.
  * 500 Internal Server Error: Error retrieving data.

### Feedback

Feel free to use Github's feedback mechanisms or join our discord https://discord.gg/JbhQ7dREsP