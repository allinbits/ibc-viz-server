const express = require("express");
const axios = require("axios");
const app = express();
const ReconnectingWebSocket = require("reconnecting-websocket");

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

app.get("/txs", async (request, response) => {
  response.send("IBC");
});

app.get("/txs", async (request, response) => {
  const domain = "http://ibc.umbrellavalidator.com:26657";
  const path = "/tx_search?query=%22tx.height%3E0%22";
  const txs = (await axios.get(domain + path)).data.result.txs;
  let data = [];
  txs.forEach((tx) => {
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
        ...attributes,
      });
    });
  });
  response.json(data);
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
