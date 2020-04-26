create table if not exists txs (
  hash text primary key,
  blockchain text,
  height int,
  events jsonb
);