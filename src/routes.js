const express = require("express");
const router = express.Router();
const db = require("./db");
const axios = require("axios");

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
