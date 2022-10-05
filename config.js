require("dotenv").config();
const ENV = process.env;

const port = ENV.PORT || 5050;
const posting = ENV.posting || true
const active = ENV.active || true;
const IPFS_ENDPOINT = ENV.IPFS_ENDPOINT || "http://127.0.0.1:5001";

const config = {
  port,
  posting,
  active,
  IPFS_ENDPOINT,
};

module.exports = config