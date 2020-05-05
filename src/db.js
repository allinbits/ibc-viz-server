const fs = require("fs");
const path = require("path");
const pg = require("pg");
const config = require("./config.json");
const init = fs.readFileSync(path.resolve(__dirname, "db.sql"), "utf8");
const ReconnectingWebSocket = require("reconnecting-websocket");
const WebSocket = require("ws");
const _ = require("lodash");
const superagent = require("superagent");
const axios = require("axios");

let client;

const socketInit = (blockchains, io) => {
  const subscribe = {
    jsonrpc: "2.0",
    method: "subscribe",
    id: "1",
    params: ["tm.event = 'Tx'"],
  };
  blockchains.forEach((b) => {
    const [domain, port] = b.node_addr.split(":");
    const url = `ws://${domain}:${port}/websocket`;
    let socket = new ReconnectingWebSocket(url, [], { WebSocket });
    socket.onopen = () => {
      // console.log("open", domain);
      socket.send(JSON.stringify(subscribe));
    };
    socket.onmessage = async (msg) => {
      try {
        const tx = JSON.parse(msg.data);
        if (!tx.result || Object.keys(tx.result).length < 1) {
          console.log(
            "Skipping tx from a socket connection: events array is empty."
          );
          return;
        }
        io.emit("all", {
          domain,
          tx,
          hash: tx.result.events["tx.hash"][0],
          events: processTxEvents(tx.result.data.value.TxResult.result.events),
        });
        const hash = tx.result.events["tx.hash"][0];
        const events = processTxEvents(
          tx.result.data.value.TxResult.result.events
        );
        const height = tx.result.data.value.TxResult.height;
        // events.forEach((event) => {
        //   if (event.type === "send_packet") {
        //     console.log(
        //       objectifyPacket(
        //         processPacket(hash, events, domain, height, "send_packet")
        //       )
        //     );
        //   }
        // });
        processTx(hash, events, domain, height);
        insertTx(hash, events, domain, height, "socket");
      } catch {
        console.log("Skipping tx from socket connection.");
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

const insertTx = (hash, events, domain, height, source) => {
  const columns = "hash, blockchain, events, height, source";
  const values = "$1, $2, $3, $4, $5";
  const conflict = "conflict (hash) do update set source = 'search'";
  client.query(
    `insert into txs (${columns}) values (${values}) on ${conflict}`,
    [hash, domain, { ...events }, height, source]
  );
};

const processTxs = async () => {
  console.log("processTxs start...");
  const query = "select * from txs where source = 'search'";
  const txs = (await client.query(query)).rows;
  txs.forEach((tx) => {
    try {
      processTx(tx.hash, Object.values(tx.events), tx.blockchain, tx.height);
    } catch {
      console.log("Error in processTx.");
    }
  });
  console.log("processTxs finished...");
};

const processTx = (hash, events, blockchain, height) => {
  events.forEach((event) => {
    if (event.type === "send_packet") {
      insertPacket(
        processPacket(hash, event, blockchain, height, "send_packet")
      );
    }
    if (event.type === "recv_packet") {
      insertPacket(
        processPacket(hash, event, blockchain, height, "recv_packet")
      );
    }
  });
};

insertPacket = (packet) => {
  const columns = packet.map((c) => c[0]).join(",");
  const values = packet.map((c, i) => `$${i + 1}`).join(",");
  const query = `insert into packets (id, ${columns}) values (default, ${values}) on conflict do nothing`;
  client.query(
    query,
    packet.map((d) => d[1])
  );
};

const objectifyPacket = (packet) => {
  let obj = {};
  packet.forEach((p) => {
    obj[p[0]] = p[1];
  });
  return obj;
};

const processPacket = (hash, { attributes }, blockchain, height, type) => {
  const packet_data = JSON.parse(_.find(attributes, { key: "packet_data" }).val)
    .value;
  const packet_sequence = _.find(attributes, { key: "packet_sequence" }).val;
  const packet_src_channel = _.find(attributes, { key: "packet_src_channel" })
    .val;
  const packet_dst_channel = _.find(attributes, { key: "packet_dst_channel" })
    .val;
  return [
    ["hash", hash],
    ["blockchain", blockchain],
    ["height", height],
    ["sender", packet_data.sender],
    ["receiver", packet_data.receiver],
    ["amount", packet_data.amount[0].amount],
    ["denom", packet_data.amount[0].denom],
    ["type", type],
    ["packet_sequence", packet_sequence],
    ["packet_src_channel", packet_src_channel],
    ["packet_dst_channel", packet_dst_channel],
  ];
};

const fetchTxs = async () => {
  const fetchTxsByPage = (domainWithPort, page = 0, height = 0) => {
    const [domain, port] = domainWithPort.split(":");
    return new Promise((resolve) => {
      const url = `http://${domain}:${port}/tx_search?query=%22tx.height>0%22&per_page=100&page=${page}`;
      console.log(
        `Fetching from ${domain} on page ${page} with height > ${height}`
      );
      axios
        .get(url)
        .then(({ data }) => {
          // const data = JSON.parse(res.text);
          if (data && data.result) {
            try {
              data.result.txs.forEach((tx) => {
                const events = processTxEvents(tx.tx_result.events || {});
                insertTx(tx.hash, events, domain, tx.height, "search");
              });
            } catch (error) {
              console.log("Some error.", error);
            }
            resolve(fetchTxsByPage(domain, page + 1, height));
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
    config.blockchains.map(async (b) => {
      const domain = b.node_addr;
      const query = `select * from txs where blockchain = $1 and source = 'search' order by height desc limit 1`;
      const latestTx = (await client.query(query, [domain])).rows[0];
      const height = latestTx ? latestTx.height : 0;
      return fetchTxsByPage(domain, 1, height);
    })
  );
};

module.exports = {
  init: async (io) => {
    client = await connect();
    await client.query(init);
    socketInit(config.blockchains, io);
    await fetchTxs();
    processTxs();
  },
  query: (text, params, callback) => {
    return client.query(text, params, callback);
  },
  fetchTxs,
};
