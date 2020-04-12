const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const http = require("http").createServer(app);
const db = require("./db");
const routes = require("./routes");

db.init();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.use("/", routes);

const port = process.env.PORT || 80;

http.listen(port, () => {
  console.log("Your app is listening on port " + port);
});
