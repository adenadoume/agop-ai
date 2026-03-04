-- agop-ai Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ikrwffjpvfzdymphhchk/sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Conversations ──────────────────────────────────────────────────────────
create table if not exists conversations (
  id                   uuid primary key default uuid_generate_v4(),
  title                text not null default 'New Conversation',
  model                text not null default 'claude-sonnet-4-6',
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  total_cost           numeric default 0,
  total_input_tokens   int default 0,
  total_output_tokens  int default 0,
  message_count        int default 0
);

-- ─── Messages ────────────────────────────────────────────────────────────────
create table if not exists messages (
  id                uuid primary key default uuid_generate_v4(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant')),
  content           text not null,
  model             text,
  input_tokens      int default 0,
  output_tokens     int default 0,
  cost              numeric default 0,
  created_at        timestamptz default now()
);

-- ─── Uploaded Files ──────────────────────────────────────────────────────────
create table if not exists uploaded_files (
  id                uuid primary key default uuid_generate_v4(),
  conversation_id   uuid references conversations(id) on delete cascade,
  message_id        uuid references messages(id) on delete set null,
  filename          text not null,
  file_type         text,
  file_size         int,
  storage_path      text,
  created_at        timestamptz default now()
);

-- ─── Memory (agop-ai brain, shareable with Claude Code) ──────────────────────
create table if not exists memory (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  value       text not null,
  updated_at  timestamptz default now()
);

-- Seed with initial memory entry
insert into memory (key, value) values
  ('MEMORY_MD', '# agop-ai Memory\n\nThis memory is shared with Claude Code via sync-memory.py\n')
on conflict (key) do nothing;

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_messages_conversation_id on messages(conversation_id);
create index if not exists idx_conversations_updated_at on conversations(updated_at desc);
create index if not exists idx_conversations_created_at on conversations(created_at desc);

-- ─── RLS: disable for personal use (no auth) ─────────────────────────────────
alter table conversations disable row level security;
alter table messages disable row level security;
alter table uploaded_files disable row level security;
alter table memory disable row level security;

-- ─── Updated_at trigger ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

create trigger memory_updated_at
  before update on memory
  for each row execute function update_updated_at();
