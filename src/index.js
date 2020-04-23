const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const http = require("http");
const https = require("https");
const db = require("./db");
const routes = require("./routes");
const fs = require("fs");
const io = require("socket.io");

let ssl;
let httpServer;
let httpsServer;

try {
  ssl = {
    key: fs.readFileSync("key", "utf8"),
    cert: fs.readFileSync("cert", "utf8"),
  };
} catch {
  console.log("Key and certificate not found.");
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.use("/", routes);

httpServer = http.createServer(app);

if (ssl) {
  httpsServer = https.createServer(ssl, app);
  db.init(io(httpsServer));
  httpsServer.listen(443);
} else {
  db.init(io(httpServer));
}

httpServer.listen(80);
