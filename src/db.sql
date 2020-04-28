create table if not exists txs (
  hash text primary key,
  blockchain text,
  height int,
  events jsonb
);

create table if not exists transfers (
  hash text primary key,
  blockchain text,
  height int,
  sender text,
  receiver text,
  amount int,
  denom text,
  type text
);