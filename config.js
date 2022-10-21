require("dotenv").config();
const ENV = process.env;

const port = ENV.PORT || 5050;
const posting = ENV.posting || true
const active = ENV.active || true;
const ENDPOINT = ENV.ENDPOINT || "localhost:5001";
const HIVE_API = ENV.HIVE_API || "https://anyx.io";

const config = {
  port,
  posting,
  active,
  ENDPOINT,
  HIVE_API,
};

module.exports = config