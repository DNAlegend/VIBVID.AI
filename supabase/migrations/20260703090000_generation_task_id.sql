-- Real (non-simulated) video generations run as async BytePlus Ark tasks;
-- the task id is stored so the status endpoint can poll and finalize.
alter table public.generations add column if not exists task_id text;
