begin;
alter table public.community_messages add column reply_to uuid references public.community_messages(id) on delete set null;
grant insert(reply_to) on public.community_messages to authenticated;
-- Replies can reference only a message in the same public room.
create function public.check_chat_reply_room() returns trigger language plpgsql set search_path='' as $$
begin
 if new.reply_to is not null and not exists(select 1 from public.community_messages where id=new.reply_to and room=new.room) then raise exception 'chat_reply_room_mismatch'; end if;
 return new;
end; $$;
revoke all on function public.check_chat_reply_room() from public,anon,authenticated;
create trigger check_chat_reply_room before insert on public.community_messages for each row execute function public.check_chat_reply_room();
create table public.community_reactions (
 message_id uuid not null references public.community_messages(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 emoji text not null check(emoji in ('👍','❤️','🎮')),
 primary key(message_id,user_id,emoji)
);
alter table public.community_reactions enable row level security;
revoke all on public.community_reactions from anon,authenticated;
grant select on public.community_reactions to anon,authenticated;
grant insert(message_id,user_id,emoji),delete on public.community_reactions to authenticated;
create policy "Read reactions" on public.community_reactions for select to anon,authenticated using(true);
create policy "React as yourself" on public.community_reactions for insert to authenticated with check(auth.uid()=user_id and (auth.jwt()->>'is_anonymous') is distinct from 'true');
create policy "Remove own reactions" on public.community_reactions for delete to authenticated using(auth.uid()=user_id);
create table public.community_reports (
 message_id uuid not null references public.community_messages(id) on delete cascade,
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 reason text not null check(char_length(btrim(reason)) between 3 and 500),
 created_at timestamptz not null default now(),
 primary key(message_id,user_id)
);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from anon,authenticated;
grant insert(message_id,user_id,reason) on public.community_reports to authenticated;
create policy "Report as yourself" on public.community_reports for insert to authenticated with check(auth.uid()=user_id and (auth.jwt()->>'is_anonymous') is distinct from 'true');
create function public.community_room_activity(since jsonb default '{}'::jsonb) returns table(room text,latest_at timestamptz,unread bigint)
language sql stable security invoker set search_path='' as $$
 select r.name,coalesce(max(m.created_at),now()),count(m.id) filter(where m.created_at>coalesce((since->>r.name)::timestamptz,now()))
 from (values('general'),('gaming'),('help')) r(name) left join public.community_messages m on m.room=r.name group by r.name;
$$;
revoke all on function public.community_room_activity(jsonb) from public;
grant execute on function public.community_room_activity(jsonb) to anon,authenticated;
-- Reports are not publicly readable and cannot be edited by visitors.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.community_reactions; end if;
end $$;
commit;
