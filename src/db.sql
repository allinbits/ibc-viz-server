create table if not exists txs (
  hash text primary key,
  blockchain text,
  tx text,
  height int,
  events jsonb
);