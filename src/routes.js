const express = require("express");
const router = express.Router();
const db = require("./db");
const axios = require("axios");
const _ = require("lodash");

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

router.get("/txs/fetch", async (req, res) => {
  await db.fetchTxs();
  res.redirect(303, "/txs");
});

router.get("/blockchains", async (req, res) => {
  data = (await db.fetchBlockchains()).rows;
  res.json(data);
});

router.get("/transfers", async (req, res) => {
  data = (await db.query("select * from transfers")).rows;
  res.json(data);
});

router.get("/relations", async (req, res) => {
  let data = {};
  const txs = (await db.query("select * from txs")).rows;
  txs.forEach((tx) => {
    const e = tx.events.events;
    if (_.find(e, "sender")) {
      const sender = _.find(e, "sender").sender;
      if (
        _.find(e, { action: "sender" }) ||
        _.find(e, { action: "create_client" }) ||
        _.find(e, { action: "transfer" }) ||
        _.find(e, { action: "connection_open_ack" }) ||
        _.find(e, { action: "connection_open_confirm" }) ||
        _.find(e, { action: "channel_open_confirm" }) ||
        _.find(e, { action: "channel_open_try" }) ||
        _.find(e, { action: "connection_open_try" }) ||
        _.find(e, { action: "channel_open_init" }) ||
        _.find(e, { action: "send" }) ||
        _.find(e, { action: "channel_open_ack" }) ||
        _.find(e, { action: "connection_open_init" })
      ) {
        data[sender] = tx.blockchain;
      }
    }
  });
  res.json(data);
});

router.get("/health", async (req, res) => {
  const blockchain = req.query.blockchain;
  let data;
  try {
    data = (await axios.get(`http://${blockchain}:26657/health`)).data;
    res.send(data);
  } catch {
    data = null;
    res.sendStatus(404);
  }
});

module.exports = router;
