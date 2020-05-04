create extension if not exists "uuid-ossp";

create table if not exists txs (
  hash text primary key,
  blockchain text,
  height int,
  events jsonb,
  source text
);

drop table if exists packets;
create table if not exists packets (
  id uuid default uuid_generate_v4() not null,
  hash text primary key,
  blockchain text,
  height int,
  sender text,
  receiver text,
  amount text,
  denom text,
  type text,
  packet_sequence text,
  packet_src_channel text,
  packet_dst_channel text
);