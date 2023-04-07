require("dotenv").config();
const ENV = process.env;
const dbcs = ENV.DATABASE_URL || "";
const port = ENV.PORT || 5050;
const account = ENV.ACCOUNT || '';
const posting_key = ENV.POSTING || ''
const active_key = ENV.ACTIVE || ''
const ENDPOINT = ENV.ENDPOINT || "localhost";
const ENDPORT = ENV.ENDPORT || 5001
const HIVE_API = ENV.HIVE_API || "https://api.hive.blog";
const SPK_API = ENV.SPK_API || "https://spktest.dlux.io";

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
  HIVE_API,
  SPK_API,
  tables
};

module.exports = config