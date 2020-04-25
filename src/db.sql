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
  amount integer,
  denom text,
  sender text,
  recipient text,
  type text
)
