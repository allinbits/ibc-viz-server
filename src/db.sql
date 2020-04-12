create table if not exists txs_encoded (
  id text primary key,
  tx text
);

create table if not exists txs (
  id text primary key,
  tx jsonb
);