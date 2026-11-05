-- Review and run this file in the Supabase SQL Editor for the existing project.
-- Adds chat only. No changes to Gallery, tier lists, Auth settings, or secrets.
begin;
create table public.community_messages (
 id uuid primary key default gen_random_uuid(),
 room text not null check (room in ('general','gaming','help')),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 1 and 32),
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index community_messages_room_time on public.community_messages(room, created_at desc, id desc);
alter table public.community_messages enable row level security;
revoke all on public.community_messages from anon, authenticated;
grant select on public.community_messages to anon, authenticated;
grant insert (room,user_id,display_name,body) on public.community_messages to authenticated;
grant delete on public.community_messages to authenticated;
create policy "Public chat history" on public.community_messages for select to anon, authenticated using (true);
create policy "Send as yourself" on public.community_messages for insert to authenticated with check ((select auth.uid()) = user_id and (select auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy "Delete your own messages" on public.community_messages for delete to authenticated using ((select auth.uid()) = user_id);
-- Separate protected throttle state survives deletion of a user's messages.
create table public.community_chat_throttle (user_id uuid primary key references auth.users(id) on delete cascade, last_sent timestamptz not null);
alter table public.community_chat_throttle enable row level security;
revoke all on public.community_chat_throttle from anon, authenticated;
create function public.check_community_chat_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
declare previous_time timestamptz;
begin
 if auth.uid() is null or auth.uid() <> new.user_id then raise exception 'chat_auth_required'; end if;
 insert into public.community_chat_throttle(user_id,last_sent) values(new.user_id, '-infinity') on conflict do nothing;
 select last_sent into previous_time from public.community_chat_throttle where user_id=new.user_id for update;
 if previous_time > clock_timestamp() - interval '5 seconds' then raise exception 'chat_rate_limit'; end if;
 update public.community_chat_throttle set last_sent=clock_timestamp() where user_id=new.user_id;
 new.created_at := clock_timestamp();
 new.body := btrim(new.body);
 new.display_name := btrim(new.display_name);
 return new;
end;
$$;
revoke all on function public.check_community_chat_rate() from public, anon, authenticated;
create trigger community_chat_rate before insert on public.community_messages for each row execute function public.check_community_chat_rate();
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='community_messages') then
   alter publication supabase_realtime add table public.community_messages;
 end if;
end $$;
commit;
