const express = require("express");
const router = express.Router();
const db = require("./db");
const axios = require("axios");
const _ = require("lodash");
const config = require("./config.json");

router.get("/", async (req, res) => {
  res.json({ api: "ok" });
});

router.get("/txs", async (req, res) => {
  const blockchain = req.query.blockchain;
  let data;
  if (blockchain) {
    const query =
      "select * from txs where blockchain = $1 order by height desc";
    data = (await db.query(query, [blockchain])).rows;
  } else {
    const query = "select * from txs order by height desc";
    data = (await db.query(query)).rows;
  }
  res.json(data);
});

router.get("/packets", async (req, res) => {
  let data;
  const blockchain = req.query.blockchain;
  if (blockchain) {
    const query = `select * from packets where blockchain = $1`;
    data = (await db.query(query, [blockchain])).rows;
  } else {
    const query = `select * from packets`;
    data = (await db.query(query)).rows;
  }
  res.json(data);
});

router.get("/connections", async (req, res) => {
  let connections = {};
  const txs = (await db.query("select * from packets")).rows;
  txs.forEach((tx) => {
    if (tx.type === "send_packet") {
      const pair = `${tx.sender}-${tx.receiver}`;
      if (pair in connections) {
        connections[pair]++;
      } else {
        connections[pair] = 1;
      }
    }
  });
  connections = Object.keys(connections).map((pair) => {
    const [sender, receiver] = pair.split("-");
    const count = connections[pair];
    return { sender, receiver, count };
  });
  res.json(connections);
});

router.get("/blockchains", async (req, res) => {
  res.json(config.blockchains);
});

router.get("/relations", async (req, res) => {
  let data = {};
  const txs = (await db.query("select * from packets")).rows;
  txs.forEach((tx) => {
    if (tx.type === "send_packet") {
      data[tx.sender] = tx.blockchain;
    }
    if (tx.type === "recv_packet") {
      data[tx.receiver] = tx.blockchain;
    }
  });
  res.json(data);
});

router.get("/ranking", async (req, res) => {
  let data = {};
  const txs = (await db.query("select * from packets")).rows;
  txs.forEach((tx) => {
    const empty = { outgoing: 0, incoming: 0, blockchain: tx.blockchain };
    data[tx.blockchain] = data[tx.blockchain] || empty;
    if (tx.type === "send_packet") {
      data[tx.blockchain].outgoing++;
    }
    if (tx.type === "recv_packet") {
      data[tx.blockchain].incoming++;
    }
  });
  res.json(Object.values(data));
});

router.get("/count", async (req, res) => {
  let data = {};
  data = (await db.query("select count(*) from txs")).rows;
  res.json({ data });
});

router.get("/update_client", async (req, res) => {
  let data = {};
  const txs = (await db.query("select * from txs order by height desc")).rows;
  txs.forEach((tx) => {
    Object.values(tx.events).forEach((event) => {
      event.attributes.forEach((attr) => {
        if (attr.val === "update_client") {
          if (data[tx.blockchain]) {
            data[tx.blockchain].push(tx.height);
          } else {
            data[tx.blockchain] = [];
          }
        }
      });
    });
  });
  let response = {};
  Object.keys(data).forEach((key) => {
    const lastHeight = data[key][0];
    response[key] = lastHeight;
  });
  res.json(response);
});

router.get("/counterparty_client_id", async (req, res) => {
  let data = {};
  const txs = (await db.query("select * from txs order by height desc")).rows;
  txs.forEach((tx) => {
    Object.values(tx.events).forEach((event) => {
      event.attributes.forEach((attr) => {
        if (attr.key === "counterparty_client_id") {
          data[attr.val] = tx.blockchain;
          // if (data[tx.blockchain]) {
          //   data[tx.blockchain].push(attr.val);
          // } else {
          //   data[tx.blockchain] = [];
          // }
        }
      });
    });
  });
  // let response = {};
  // Object.keys(data).forEach((key) => {
  //   response[key] = [...new Set(data[key])];
  // });
  res.json(data);
});

router.get("/create_client", async (req, res) => {
  let data = {};
  const txs = (await db.query("select * from txs order by height desc")).rows;
  txs.forEach((tx) => {
    Object.values(tx.events).forEach((event) => {
      if (event.type === "create_client") {
        event.attributes.forEach((attr) => {
          if (attr.key === "client_id") {
            data[attr.val] = tx.blockchain;
            // if (data[tx.blockchain]) {
            //   data[tx.blockchain].push(attr.val);
            // } else {
            //   data[tx.blockchain] = [];
            // }
          }
        });
      }
    });
  });
  // let response = {};
  // Object.keys(data).forEach((key) => {
  //   response[key] = [...new Set(data[key])];
  // });
  res.json(data);
});

router.get("/health", async (req, res) => {
  const blockchain = req.query.blockchain;
  let data;
  try {
    data = (await axios.get(`http://${blockchain}:26657/status`)).data;
    res.send(data);
  } catch {
    data = null;
    res.sendStatus(404);
  }
});

module.exports = router;
