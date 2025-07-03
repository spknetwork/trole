require("dotenv").config();
const ENV = process.env;
const dbcs = ENV.DATABASE_URL || "";
const base_grant = ENV.BASE_GRANT || 30000;
const port = ENV.PORT || 5050;
const account = ENV.ACCOUNT || '';
const posting_key = ENV.POSTING || ''
const ipfsid = ENV.IPFSID || ''
const active_key = ENV.ACTIVE || ''
const posting_pub = ENV.POSTING_PUB || ''
const ENDPOINT = ENV.ENDPOINT || "127.0.0.1";
const ENDPORT = ENV.ENDPORT || 5001
const IPFS_GATEWAY_PORT = ENV.IPFS_GATEWAY_PORT || 8080
const ENDPROTOCOL = ENV.ENDPROTOCOL || "http"
const IPFS_PROXY_API = ENV.IPFS_PROXY_API || `${ENDPROTOCOL}://${ENDPOINT}:${IPFS_GATEWAY_PORT}`;
const HIVE_API = ENV.HIVE_API || "https://api.hive.blog";
const SPK_API = ENV.SPK_API || "https://spktest.dlux.io";
const flex = ENV.FLEX || 10000000 //upload temp space limit
const docker = ENV.DOCKER || false
const maxJsonLength = ENV.MAX_JSON_LENGTH || 7800
const chunkSize = ENV.CHUNK_SIZE || 7750
const promo_contract = ENV.PROMO_CONTRACT || false
const chunkMaxRetries = ENV.CHUNK_MAX_RETRIES || 3
const chunkVerificationDelay = ENV.CHUNK_VERIFICATION_DELAY || 5000
const chunkRetryDelay = ENV.CHUNK_RETRY_DELAY || 3000
const HEALTH_ENDPOINT_IP = ENV.HEALTH_ENDPOINT_IP || '0.0.0.0'
const PEER_TEST_INTERVAL = ENV.PEER_TEST_INTERVAL || 300000
const HEALTH_WINDOW_SIZE = ENV.HEALTH_WINDOW_SIZE || 100
const MIN_TESTS_FOR_SCORE = ENV.MIN_TESTS_FOR_SCORE || 10
const NODE_REGION = ENV.NODE_REGION || 'unknown'

const tables = {
  db:{
    pins: {
      name: "pins",
      table: {
        hash: {
          type: "VARCHAR",
          key: true,
        },
        size: {
          type: "INT",
          key: false,
        },
        ts: {
          type: "BIGINT",
          key: false,
        },
        account: {
          type: "VARCHAR",
          key: false,
        },
        sig: {
          type: "VARCHAR",
          key: false,
        },
        exp: {
          type: "BIGINT",
          key: false,
        },
        contract: {
          type: "VARCHAR",
          key: false,
        },
        pinned: {
          type: "BOOLEAN",
          key: false,
        },
        flag: {
          type: "INT",
          key: false
        },
        state: { //0 unhandled, 1 pending, 2 accepted, 3 withdrawn /expired
          type: "INT",
          key: false
        }
      },
    }
  }
};

const config = {
  port,
  dbcs,
  account,
  active_key,
  posting_key,
  ENDPOINT,
  ENDPORT,
  ENDPROTOCOL,
  HIVE_API,
  SPK_API,
  tables,
  ipfsid,
  posting_pub,
  base_grant,
  docker,
  maxJsonLength,
  chunkSize,
  promo_contract,
  chunkMaxRetries,
  chunkVerificationDelay,
  chunkRetryDelay,
  IPFS_PROXY_API,
  HEALTH_ENDPOINT_IP,
  PEER_TEST_INTERVAL,
  HEALTH_WINDOW_SIZE,
  MIN_TESTS_FOR_SCORE,
  NODE_REGION
};

module.exports = config