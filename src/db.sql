create table if not exists txs_encoded (
  id text primary key,
  tx text,
  blockchain text,
  decoding_failed boolean
);

create table if not exists txs (
  id text primary key,
  blockchain text,
  tx jsonb
);