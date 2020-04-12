const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  res.json({ ibc: "ok" });
});

module.exports = router;
