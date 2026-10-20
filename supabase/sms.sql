-- Text-message access to the library (used by the arynlynn.com text service).
-- Run once after schema.sql and public-view.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run. It's safe to run again.
--
-- The text service never gets a key to the whole database. It can only call the four sms_* functions
-- below, and each one checks a text-service password first. Only a SHA-256 hash of that password is
-- stored here. If the password ever leaks, it can only add books, record loans and returns, and list
-- open loans: it can't read anything else, edit or delete books, or see contact details.
--
-- To create (or replace) the password, run this on its own and copy the result into Netlify as
-- LIBRARY_SMS_SECRET:
--   select private.new_sms_secret();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sms_secret (
  singleton boolean primary key default true check (singleton),
  secret_hash text not null,
  created_at timestamptz not null default now()
);

-- Makes a new random password (two random UUIDs, about 244 bits), stores only its hash, and returns it once.
create or replace function private.new_sms_secret()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  secret text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into private.sms_secret (secret_hash) values (encode(sha256(convert_to(secret, 'UTF8')), 'hex'))
  on conflict (singleton) do update set secret_hash = excluded.secret_hash, created_at = now();
  return secret;
end
$$;
revoke all on function private.new_sms_secret() from public, anon, authenticated;

-- Stops the request unless the password matches. Without a password set, every request is refused.
create or replace function private.check_sms_secret(secret text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if secret is null or not exists (
    select 1 from private.sms_secret s where s.secret_hash = encode(sha256(convert_to(secret, 'UTF8')), 'hex')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end
$$;
revoke all on function private.check_sms_secret(text) from public, anon, authenticated;

-- Adds a book to the owner's library with a random cover. Returns the new book's id.
create or replace function public.sms_add_book(
  secret text,
  book_title text,
  book_author text default '',
  book_isbn text default null,
  book_year integer default null,
  book_pages integer default null,
  added_on date default current_date
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  colors text[] := array['pink', 'peach', 'yellow', 'mint', 'sky', 'lilac', 'wine', 'navy', 'forest', 'cream'];
  patterns text[] := array['plain', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'waves'];
  new_id uuid;
begin
  perform private.check_sms_secret(secret);
  insert into public.books (owner_id, title, author, isbn, year, pages, cover_color, cover_pattern, notes, acquired_on)
  values (
    public.site_owner_id(),
    btrim(book_title),
    coalesce(btrim(book_author), ''),
    nullif(btrim(book_isbn), ''),
    book_year,
    book_pages,
    colors[1 + floor(random() * array_length(colors, 1))::int],
    patterns[1 + floor(random() * array_length(patterns, 1))::int],
    'Added by text.',
    coalesce(added_on, current_date)
  )
  returning id into new_id;
  return new_id;
end
$$;

-- Finds the owner's books whose title contains the search, with who has them (if anyone). At most 5.
create or replace function public.sms_find_books(secret text, search text)
returns table (book_id uuid, title text, author text, borrower text, due_on date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.check_sms_secret(secret);
  return query
    select b.id, b.title, b.author, l.borrower, l.due_on
    from public.books b
    left join public.loans l on l.book_id = b.id and l.returned_on is null
    where b.owner_id = public.site_owner_id()
      and b.title ilike '%' || replace(replace(replace(btrim(search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    order by (lower(b.title) = lower(btrim(search))) desc, b.title
    limit 5;
end
$$;

-- Checks a book out. Fails if it's already out (the unique open-loan index enforces this too).
create or replace function public.sms_check_out(secret text, book uuid, borrower_name text, loaned date, due date default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.check_sms_secret(secret);
  if not exists (select 1 from public.books b where b.id = book and b.owner_id = public.site_owner_id()) then
    raise exception 'book not found' using errcode = 'P0002';
  end if;
  insert into public.loans (owner_id, book_id, borrower, loaned_on, due_on, notes)
  values (public.site_owner_id(), book, btrim(borrower_name), loaned, due, 'Checked out by text.');
end
$$;

-- Checks a book back in. Returns who had it, or nothing if it wasn't out.
create or replace function public.sms_return(secret text, book uuid, returned date)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  who text;
begin
  perform private.check_sms_secret(secret);
  update public.loans l
  set returned_on = returned
  where l.book_id = book and l.returned_on is null and l.owner_id = public.site_owner_id()
  returning l.borrower into who;
  return who;
end
$$;

-- Lists open loans (title, who has it, dates), oldest first.
create or replace function public.sms_open_loans(secret text)
returns table (title text, borrower text, loaned_on date, due_on date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.check_sms_secret(secret);
  return query
    select b.title, l.borrower, l.loaned_on, l.due_on
    from public.loans l
    join public.books b on b.id = l.book_id
    where l.returned_on is null and l.owner_id = public.site_owner_id()
    order by l.loaned_on, b.title;
end
$$;

-- Only these four functions are reachable with the publishable key, and each needs the password.
revoke all on function public.sms_add_book(text, text, text, text, integer, integer, date) from public;
revoke all on function public.sms_find_books(text, text) from public;
revoke all on function public.sms_check_out(text, uuid, text, date, date) from public;
revoke all on function public.sms_return(text, uuid, date) from public;
revoke all on function public.sms_open_loans(text) from public;
grant execute on function public.sms_add_book(text, text, text, text, integer, integer, date) to anon;
grant execute on function public.sms_find_books(text, text) to anon;
grant execute on function public.sms_check_out(text, uuid, text, date, date) to anon;
grant execute on function public.sms_return(text, uuid, date) to anon;
grant execute on function public.sms_open_loans(text) to anon;
