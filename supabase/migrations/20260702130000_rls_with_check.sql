-- Harden RLS: UPDATE policies previously had only USING, so an authenticated
-- user could UPDATE their own row and set user_id to another user's id,
-- planting rows in someone else's library. WITH CHECK validates the NEW row.

alter policy "profiles_update_own" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "categories_update_own" on public.categories
  with check ((select auth.uid()) = user_id);

alter policy "assets_update_own" on public.assets
  with check ((select auth.uid()) = user_id);

alter policy "generations_update_own" on public.generations
  with check ((select auth.uid()) = user_id);

alter policy "assets_bucket_update_own" on storage.objects
  with check (bucket_id = 'assets' and (storage.foldername(name))[1] = (select auth.uid()::text));
