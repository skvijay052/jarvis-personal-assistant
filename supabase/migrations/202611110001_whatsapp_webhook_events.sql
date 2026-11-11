create table if not exists public.whatsapp_webhook_events (
  message_id text primary key,
  sender text not null,
  message_type text not null,
  received_at timestamptz not null default now()
);

alter table public.whatsapp_webhook_events enable row level security;

-- No client-facing policies: only the server-side service-role key can access
-- this internal idempotency table. Never expose the service-role key to clients.
