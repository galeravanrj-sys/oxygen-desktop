begin;
create table public.announcement_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.announcement_admins enable row level security;
revoke all on public.announcement_admins from public,anon,authenticated;

create table public.announcements (
 id uuid primary key default gen_random_uuid(),
 title text not null check(char_length(btrim(title)) between 1 and 140),
 body text not null check(char_length(btrim(body)) between 1 and 2000),
 status text not null default 'draft' check(status in ('draft','published')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 published_at timestamptz,
 check((status='draft' and published_at is null) or (status='published' and published_at is not null))
);
create index announcements_published_idx on public.announcements(published_at desc) where status='published';
alter table public.announcements enable row level security;
revoke all on public.announcements from public,anon,authenticated;

create function public.announcement_admin_status() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.announcement_admins a join auth.users u on u.id=a.user_id
 where a.user_id=auth.uid() and u.email_confirmed_at is not null and coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
$$;
revoke all on function public.announcement_admin_status() from public,anon;
grant execute on function public.announcement_admin_status() to authenticated;

create function public.list_announcements() returns table(id uuid,title text,body text,published_at timestamptz)
language sql stable security definer set search_path='' as $$
 select a.id,a.title,a.body,a.published_at from public.announcements a
 where a.status='published' and a.published_at<=now() order by a.published_at desc,a.id desc limit 100;
$$;
revoke all on function public.list_announcements() from public;
grant execute on function public.list_announcements() to anon,authenticated,service_role;

create function public.admin_list_announcements() returns setof public.announcements
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.announcement_admin_status() then raise exception 'Admin access required' using errcode='42501'; end if;
 return query select * from public.announcements order by created_at desc limit 100;
end; $$;
create function public.save_announcement(p_title text,p_body text,p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.announcement_admin_status() then raise exception 'Admin access required' using errcode='42501'; end if;
 if char_length(btrim(p_title)) not between 1 and 140 or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'Invalid announcement'; end if;
 if p_id is null then
  insert into public.announcements(title,body,created_by) values(btrim(p_title),btrim(p_body),auth.uid()) returning id into result;
 else
  update public.announcements set title=btrim(p_title),body=btrim(p_body) where id=p_id and status='draft' returning id into result;
  if result is null then raise exception 'Draft unavailable'; end if;
 end if;
 return result;
end; $$;
create function public.publish_announcement(p_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if not public.announcement_admin_status() then raise exception 'Admin access required' using errcode='42501'; end if;
 update public.announcements set status='published',published_at=now() where id=p_id and status='draft' returning id into result;
 if result is null then raise exception 'Draft unavailable or already published'; end if;
 return result;
end; $$;
revoke all on function public.admin_list_announcements(),public.save_announcement(text,text,uuid),public.publish_announcement(uuid) from public,anon;
grant execute on function public.admin_list_announcements(),public.save_announcement(text,text,uuid),public.publish_announcement(uuid) to authenticated;
commit;
