-- Adds ZZZ to the existing tier cache; existing payloads and permissions stay intact.
begin;
alter table public.games_tierlist_cache drop constraint games_tierlist_cache_game_check;
alter table public.games_tierlist_cache add constraint games_tierlist_cache_game_check check (game in ('genshin','origin','hsr','grandcross','zzz'));
commit;
