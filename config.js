require("dotenv").config();
const ENV = process.env;
const dbcs = ENV.DATABASE_URL || "";
const port = ENV.PORT || 5050;
const posting = ENV.posting || true
const active = ENV.active || true;
const ENDPOINT = ENV.ENDPOINT || "localhost";
const ENDPORT = ENV.ENDPORT || 5001
const HIVE_API = ENV.HIVE_API || "https://anyx.io";

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
  posting,
  active,
  dbcs,
  ENDPOINT,
  ENDPORT,
  HIVE_API,
  tables
};

module.exports = config