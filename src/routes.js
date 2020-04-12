const express = require("express");
const router = express.Router();
const db = require("./db");

router.get("/", async (req, res) => {
  res.json({ api: "ok" });
});

router.get("/txs/encoded", async (req, res) => {
  const data = (await db.query("select * from txs_encoded")).rows;
  res.json(data);
});

router.get("/txs/fetch", async (req, res) => {
  await db.fetchTxs();
  db.decodeTxs();
  res.redirect(303, "/txs");
});

router.get("/txs", async (req, res) => {
  const data = (await db.query("select * from txs")).rows;
  res.json(data);
});

module.exports = router;
