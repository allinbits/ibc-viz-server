const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const http = require("http");
const https = require("https");
const db = require("./db");
const routes = require("./routes");
const fs = require("fs");

let ssl;

db.init();

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

const httpServer = http.createServer(app);

httpServer.listen(80);

if (ssl) {
  const httpsServer = https.createServer(ssl, app);
  httpsServer.listen(443);
}
