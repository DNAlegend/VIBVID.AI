-- Distinguish demo sample results from real model output durably, so the
-- "Sample preview" labeling survives reloads and cross-device sync.
alter table public.generations add column if not exists simulated boolean not null default false;
