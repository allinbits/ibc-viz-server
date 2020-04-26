const fs = require("fs");
const path = require("path");
const pg = require("pg");
const config = require("./config.json");
const init = fs.readFileSync(path.resolve(__dirname, "db.sql"), "utf8");
const axios = require("axios");
const ReconnectingWebSocket = require("reconnecting-websocket");
const WebSocket = require("ws");
const _ = require("lodash");

let client;

axios.defaults.timeout = 3000;

const socketInit = (blockchains, io) => {
  const subscribe = {
    jsonrpc: "2.0",
    method: "subscribe",
    id: "1",
    params: ["tm.event = 'Tx'"],
  };
  blockchains.forEach((domain) => {
    let socket = new ReconnectingWebSocket(
      `ws://${domain}:26657/websocket`,
      [],
      { WebSocket }
    );
    socket.onopen = () => {
      console.log("open", domain);
      socket.send(JSON.stringify(subscribe));
    };
    socket.onmessage = async (msg) => {
      const tx = JSON.parse(msg.data);
      try {
        const hash = tx.result.events["tx.hash"][0];
        const events = processTxEvents(
          tx.result.data.value.TxResult.result.events
        );
        const height = tx.result.data.value.TxResult.height;
        insertTx(hash, events, domain, height);
        io.emit("tx", { hash, events, domain, height });
      } catch (error) {
        console.log("Error in inserting tx from a socket connection.");
      }
    };
  });
};

const connect = () => {
  return new Promise(function executor(resolve) {
    client = new pg.Pool(config.db);
    client.connect((error) => {
      if (error) {
        console.log("DB connection failed. Retrying...");
        setTimeout(executor.bind(null, resolve), 1000);
      } else {
        console.log("DB connected.");
        resolve(client);
      }
    });
  });
};

const processTxEvents = (events) => {
  return events.map((ev) => {
    e = {};
    e.type = ev.type;
    e.attributes = [];
    ev.attributes.forEach((a) => {
      const key = Buffer.from(a.key, "base64").toString("utf-8");
      const val = Buffer.from(a.value, "base64").toString("utf-8");
      e.attributes.push({ key, val });
    });
    return e;
  });
};

const insertTx = (hash, events, domain, height) => {
  client.query(
    "insert into txs (hash, blockchain, events, height) values ($1, $2, $3, $4) on conflict do nothing",
    [hash, domain, { ...events }, height]
  );
};

const fetchTxs = async () => {
  const fetchTxsByPage = (domain, page = 1) => {
    return new Promise((resolve) => {
      const url = `http://${domain}:26657/tx_search?query=%22tx.height>0%22&per_page=100&page=${page}`;
      console.log(`Fetching from ${domain} on page ${page}`);
      axios
        .get(url)
        .then(({ data }) => {
          if (data && data.result) {
            data.result.txs.forEach((tx) => {
              const events = processTxEvents(tx.tx_result.events);
              insertTx(tx.hash, events, domain, tx.height);
            });
            resolve(fetchTxsByPage(domain, page + 1));
          } else {
            console.log(`Finished fetching from ${domain} on page ${page}`);
            resolve(true);
          }
        })
        .catch((error) => {
          console.log(
            `Error in fetching from ${domain} on page ${page}, ${error}`
          );
          resolve(true);
        });
    });
  };
  return Promise.all(
    config.blockchains.map((domain) => {
      return fetchTxsByPage(domain);
    })
  );
};

module.exports = {
  init: async (io) => {
    client = await connect();
    client.query(init);
    socketInit(config.blockchains, io);
    await fetchTxs();
    console.log("Finished fetching txs.");
  },
  query: (text, params, callback) => {
    return client.query(text, params, callback);
  },
  fetchTxs,
};
