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
      let msgData = JSON.parse(msg.data);
      console.log("Message from socket!", msgData);
      io.emit("tx", { tx: msgData, blockchain: domain });
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

const insertTransfer = (
  hash,
  blockchain,
  height,
  amount,
  denom,
  sender,
  recipient,
  type
) => {
  const columns = `
    hash, blockchain, height, amount, denom, sender, recipient, type
  `;
  const query = `
    insert into transfers (${columns}) values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict do nothing
  `;
  client.query(query, [
    hash,
    blockchain,
    height,
    amount,
    denom,
    sender,
    recipient,
    type,
  ]);
};

const insertIbcTransfer = (tx, events, domain) => {
  let packet = _.find(events, "packet_data");
  packet = JSON.parse(packet.packet_data);
  amount = packet.value.amount[0].amount;
  denom = packet.value.amount[0].denom;
  sender = packet.value.sender;
  recipient = packet.value.receiver;
  type = "ibc_transfer";
  insertTransfer(
    tx.hash,
    domain,
    tx.height,
    amount,
    denom,
    sender,
    recipient,
    type
  );
};

const insertSendTransfer = (tx, events, domain) => {
  amount = parseInt(_.find(events, "amount").amount);
  denom = null;
  sender = _.find(events, "sender").sender;
  recipient = _.find(events, "recipient").recipient;
  type = "send";
  insertTransfer(
    tx.hash,
    domain,
    tx.height,
    amount,
    denom,
    sender,
    recipient,
    type
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
              let events = [];
              tx.tx_result.events.forEach((ev) => {
                let e = {};
                e[ev.type] = ev.message;
                ev.attributes.forEach((a) => {
                  const key = Buffer.from(a.key, "base64").toString("utf-8");
                  const val = Buffer.from(a.value, "base64").toString("utf-8");
                  e[key] = val;
                });
                events.push(e);
              });
              try {
                if (_.find(events, { action: "transfer" })) {
                  insertIbcTransfer(tx, events, domain);
                } else if (_.find(events, { action: "send" })) {
                  insertSendTransfer(tx, events, domain);
                }
              } catch (error) {
                console.log("Failed to insert a transaction.", error);
              }
              client.query(
                "insert into txs (hash, blockchain, events, height) values ($1, $2, $3, $4) on conflict do nothing",
                [tx.hash, domain, { events }, tx.height]
              );
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

const fetchBlockchains = () => {
  return client.query(`
    select
      count(txs.*)::int as txs_count,
      txs.blockchain
    from txs
    group by blockchain
  `);
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
  fetchBlockchains,
};
