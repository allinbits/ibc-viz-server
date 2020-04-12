create table if not exists txs_encoded (
  id text primary key,
  tx text,
  height text,
  blockchain text,
  decoding_failed boolean,
  events jsonb
);

create table if not exists txs (
  id text primary key,
  blockchain text,
  tx jsonb
);