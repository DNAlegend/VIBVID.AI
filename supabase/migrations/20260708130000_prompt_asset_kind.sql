-- Prompts become a first-class asset kind: reusable text snippets that live
-- in the library alongside videos, pictures and sound. They carry their text
-- in the existing prompt_fragment column and have an empty url.
alter table public.assets drop constraint assets_kind_check;
alter table public.assets add constraint assets_kind_check
  check (kind in ('image', 'video', 'audio', 'prompt'));
