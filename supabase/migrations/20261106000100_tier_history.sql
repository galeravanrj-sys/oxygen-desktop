begin;
alter table public.games_tierlist_cache add column previous_payload jsonb, add column previous_updated_at timestamptz;
create function public.keep_previous_tier_rankings() returns trigger language plpgsql set search_path='' as $$
begin
 if new.payload is distinct from old.payload and old.payload is not null and new.payload is not null and
 ((new.payload->'tiers') is distinct from (old.payload->'tiers') or (new.payload->'grids') is distinct from (old.payload->'grids')) then
   new.previous_payload:=old.payload;new.previous_updated_at:=old.updated_at;
 else
   new.previous_payload:=old.previous_payload;new.previous_updated_at:=old.previous_updated_at;
 end if;
 return new;
end; $$;
revoke all on function public.keep_previous_tier_rankings() from public,anon,authenticated;
create trigger keep_previous_tier_rankings before update on public.games_tierlist_cache for each row execute function public.keep_previous_tier_rankings();
commit;
