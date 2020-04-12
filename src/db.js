const fs = require("fs");
const path = require("path");
const pg = require("pg");
const config = require("./config.json");
const init = fs.readFileSync(path.resolve(__dirname, "db.sql"), "utf8");
const axios = require("axios");

let client;

axios.defaults.timeout = 3000;

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
              client.query(
                "insert into txs_encoded (id, tx, blockchain) values ($1, $2, $3) on conflict do nothing",
                [tx.hash, tx.tx, domain]
              );
            });
            resolve(fetchTxsByPage(domain, page + 1));
          } else {
            console.log(`Finished fetching from ${domain} on page ${page}`);
            resolve(true);
          }
        })
        .catch(() => {
          console.log(`Completed fetching from ${domain} on page ${page}`);
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

decodeTxs = async () => {
  const url = `http://${config.decoder}:1317/txs/decode`;
  const txs = (
    await client.query(
      "select * from txs_encoded where decoding_failed is not true;"
    )
  ).rows;
  txs.forEach(async (tx) => {
    const query = `select exists(select 1 from txs where id = $1) as "exists"`;
    const exists = !!(await client.query(query, [tx.id])).rows[0].exists;
    if (!exists) {
      console.log(`Decoding transaction ${tx.id}`);
      try {
        let data = await axios.post(url, { tx: tx.tx });
        if (data && data.data.result) {
          console.log("Decoding succeeded!", tx.id);
          const query = `insert into txs (id, tx, blockchain) values ($1, $2, $3) on conflict do nothing`;
          client.query(query, [tx.id, data.data.result], tx.blockchain);
        }
      } catch (error) {
        const err =
          error &&
          error.response &&
          error.response.data &&
          error.response.data.error;
        if (err) {
          console.log("Decoding failed!", tx.id);
          client.query(
            "update txs_encoded set decoding_failed = true where id = $1",
            [tx.id]
          );
        }
      }
    }
  });
};

module.exports = {
  init: async () => {
    client = await connect();
    client.query(init);
    await fetchTxs();
    decodeTxs();
  },
  query: (text, params, callback) => {
    return client.query(text, params, callback);
  },
  fetchTxs,
  decodeTxs,
};
