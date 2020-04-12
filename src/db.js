const fs = require("fs");
const path = require("path");
const pg = require("pg");
const config = require("./config.json");
const init = fs.readFileSync(path.resolve(__dirname, "db.sql"), "utf8");

let client;

const connect = () => {
  return new Promise((resolve) => {
    client = new pg.Pool(config.db);
    client.connect((error) => {
      if (error) {
        console.log("DB connection failed. Retrying...");
        setTimeout(() => {
          connect();
        }, 1000);
      } else {
        console.log("DB connected.");
        resolve(client);
      }
    });
  });
};

module.exports = {
  init: async () => {
    connect().then((cl) => {
      client = cl;
      client.query(init);
      //   fetchTxs();
      //   client.query("listen new_newtx");
      //   client.on("notification", async (data) => {
      //     const payload = JSON.parse(data.payload);
      //     io.emit("memo", payload);
      //   });
      //   setInterval(() => {
      //     io.emit("memo", { type: "post", body: "body" });
      //   }, 2000);
    });
  },
  query: (text, params, callback) => {
    return client.query(text, params, callback);
  },
};
