const config = require("./config");
const express = require("express");
const api = express();
var http = require("http").Server(api);
const API = require("./api");

api.use(API.auth);
api.all("*", API.proxy);

http.listen(config.port, function () {
  console.log(`API listening on port ${config.port}`);
});


