const fs = require("fs");
const path = require("path");
const pg = require("pg");
const config = require("./config.json");
const init = fs.readFileSync(path.resolve(__dirname, "db.sql"), "utf8");
const axios = require("axios");

let client;

const connect = () => {
  return new Promise((resolve) => {
    client = new pg.Pool(config.db);
    client.connect((error) => {
      if (error) {
        console.log("DB connection failed. Retrying...");
        setTimeout(() => {
          connect();
        }, 1000);
      } else {
        console.log("DB connected.");
        resolve(client);
      }
    });
  });
};

const fetchTxs = () => {
  const fetchTxsByPage = async (domain, page = 1) => {
    const url = `http://${domain}:26657/tx_search?query=%22tx.height>0%22&per_page=100&page=${page}`;
    console.log(`Fetching from ${domain} on page ${page}`);
    const data = (await axios.get(url)).data;
    if (data.result) {
      data.result.txs.forEach((tx) => {
        client.query(
          "insert into txs_encoded (id, tx) values ($1, $2) on conflict do nothing",
          [tx.hash, tx.tx]
        );
      });
      fetchTxsByPage(domain, page + 1);
    } else {
      console.log(`Finished fetching from ${domain} on page ${page}`);
    }
  };
  config.blockchains.forEach((domain) => {
    fetchTxsByPage(domain);
  });
};

decodeTxs = async () => {
  const url = `http://${config.decoder}:1317/txs/decode`;
  const txs = (await client.query("select * from txs_encoded;")).rows;
  txs.forEach(async (tx) => {
    const query = `select exists(select 1 from txs where id = $1) as "exists"`;
    const exists = !!(await client.query(query, [tx.id])).rows[0].exists;
    if (!exists) {
      console.log(`Decoding transaction ${tx.id}`);
      const decoded = (await axios.post(url, { tx: tx.tx })).data.result;
      const query = `insert into txs (id, tx) values ($1, $2) on conflict do nothing`;
      client.query(query, [tx.id, decoded]);
    }
  });
};

module.exports = {
  init: async () => {
    connect().then((cl) => {
      client = cl;
      client.query(init);
      fetchTxs();
      decodeTxs();
    });
  },
  query: (text, params, callback) => {
    return client.query(text, params, callback);
  },
  fetchTxs,
};
