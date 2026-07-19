-- Stories: the master planner that groups multiple storyboards (parts) with
-- their cast. Stored as a composite asset with class 'story' — widen the
-- class check to allow it.

alter table public.assets drop constraint if exists assets_class_check;
alter table public.assets
  add constraint assets_class_check
  check (class in ('character', 'dress', 'scene', 'dance', 'audio', 'product', 'storyboard', 'story'));
