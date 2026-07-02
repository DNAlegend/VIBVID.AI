-- Add the "product" asset class (Products section in the library).
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.assets'::regclass
     and pg_get_constraintdef(oid) like '%class%';
  if c is not null then
    execute format('alter table public.assets drop constraint %I', c);
  end if;
  alter table public.assets
    add constraint assets_class_check
    check (class in ('character', 'dress', 'scene', 'dance', 'audio', 'product'));
end $$;
