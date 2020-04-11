const express = require("express");
const axios = require("axios");
const app = express();
const ReconnectingWebSocket = require("reconnecting-websocket");
const config = require("./config.json");

app.use(express.static("public"));

const WebSocket = require("ws");
let ws = new ReconnectingWebSocket(
  "wss://ibc.umbrellavalidator.com:26657/websocket",
  [],
  {
    WebSocket: WebSocket,
  }
);

ws.onopen = function () {
  ws.send(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "subscribe",
      id: "1",
      params: ["tm.event = 'Tx'"],
    })
  );
};

ws.onmessage = function (msg) {
  console.log(msg);
};

app.get("/", async (request, response) => {
  response.send("IBC");
});

app.get("/txs", async (request, response) => {
  const path = "tx_search?query=%22tx.height%3E0%22";
  let data = [];
  const blockchains = (
    await Promise.all(
      config.blockchains.map(async (domain) => {
        const url = `http://${domain}:26657/${path}`;
        try {
          return {
            name: domain,
            txs: (await axios.get(url)).data.result.txs,
          };
        } catch {
          console.log("Fetch failed.");
        }
      })
    )
  ).filter((b) => b && b.txs);
  blockchains.forEach((blockchain) => {
    blockchain.txs.forEach((tx) => {
      tx.tx_result.events.forEach((event) => {
        let attributes = {};
        event.attributes.forEach((a) => {
          const key = Buffer.from(a.key, "base64").toString("utf-8");
          const valueRaw = Buffer.from(a.value, "base64").toString("utf-8");
          let value;
          try {
            value = JSON.parse(valueRaw);
          } catch {
            value = valueRaw;
          }
          attributes[key] = value;
        });
        data.push({
          height: tx.height,
          tx_hash: tx.hash,
          event_type: event.type,
          blockchain: blockchain.name,
          ...attributes,
        });
      });
    });
  });
  response.json(data);
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
