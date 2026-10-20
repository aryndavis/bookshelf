-- Public, read-only library. Run once after schema.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run. It's safe to run again.
--
-- Anyone can browse the owner's books. Only the owner, signed in, can add, edit, check out or delete.
-- Loans stay private: visitors only learn that a book is checked out and when it's due, never who has it.

-- Whose library is public. Exactly one row.
create table if not exists public.site_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null references auth.users (id) on delete cascade
);
alter table public.site_owner enable row level security;
revoke all on public.site_owner from anon, authenticated;

-- The owner is the project's only user. If there's ever more than one, set it by email instead:
--   insert into public.site_owner (user_id) select id from auth.users where email = 'you@example.com'
--   on conflict (singleton) do update set user_id = excluded.user_id;
do $$
begin
  if not exists (select 1 from public.site_owner) then
    if (select count(*) from auth.users) <> 1 then
      raise exception 'Expected exactly one user. Set the owner by email (see the comment above).';
    end if;
    insert into public.site_owner (user_id) select id from auth.users;
  end if;
end $$;

create or replace function public.site_owner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select user_id from public.site_owner where singleton $$;
revoke all on function public.site_owner_id() from public;
grant execute on function public.site_owner_id() to anon, authenticated;

-- Visitors can read the owner's books (reads only: no insert, update or delete).
grant select on public.books to anon;
drop policy if exists "Anyone can view the owner's books" on public.books;
create policy "Anyone can view the owner's books" on public.books
  for select to anon, authenticated
  using (owner_id = (select public.site_owner_id()));

-- Which of the owner's books are out right now, without borrower names, contact details or notes.
create or replace function public.checked_out_books()
returns table (book_id uuid, loaned_on date, due_on date)
language sql
stable
security definer
set search_path = ''
as $$
  select l.book_id, l.loaned_on, l.due_on
  from public.loans l
  where l.returned_on is null and l.owner_id = (select public.site_owner_id())
$$;
revoke all on function public.checked_out_books() from public;
grant execute on function public.checked_out_books() to anon, authenticated;
