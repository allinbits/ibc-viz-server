const express = require("express");
const router = express.Router();
const db = require("./db");

router.get("/", async (req, res) => {
  res.json({ api: "ok" });
});

router.get("/txs", async (req, res) => {
  const data = (await db.query("select * from txs")).rows;
  res.json(data);
});

router.get("/txs/events/:type?", async (req, res) => {
  const data = (await db.query("select * from txs")).rows;
  const type = req.params.type;
  let events = [];
  data.forEach((tx) => {
    tx.events.data.forEach((event) => {
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
      events.push({
        hash: tx.hash,
        blockchain: tx.blockchain,
        event_type: event.type,
        height: tx.height,
        ...attributes,
      });
    });
  });
  res.json(
    type ? events.filter((e) => e.event_type === req.params.type) : events
  );
});

router.get("/txs/fetch", async (req, res) => {
  await db.fetchTxs();
  res.redirect(303, "/txs");
});

module.exports = router;