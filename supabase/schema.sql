-- Library database for the bookshelf app.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Every row belongs to the signed-in user, and Row Level Security means each
-- user can only ever see or change their own books and loans.

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  isbn text check (isbn is null or isbn ~ '^[0-9]{9}[0-9X]$|^[0-9]{13}$'),
  genre text not null default '' check (char_length(genre) <= 80),
  year integer check (year between 0 and 3000),
  pages integer check (pages between 1 and 100000),
  cover_color text not null default 'pink'
    check (cover_color in ('pink', 'peach', 'yellow', 'mint', 'sky', 'lilac', 'wine', 'navy', 'forest', 'cream')),
  cover_pattern text not null default 'plain'
    check (cover_pattern in ('plain', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'waves')),
  notes text not null default '' check (char_length(notes) <= 2000),
  acquired_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  borrower text not null check (char_length(borrower) between 1 and 120),
  contact text not null default '' check (char_length(contact) <= 200),
  loaned_on date not null default current_date,
  due_on date,
  returned_on date,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (due_on is null or due_on >= loaned_on),
  check (returned_on is null or returned_on >= loaned_on)
);

-- A book can only be checked out to one person at a time.
create unique index if not exists loans_one_open_loan_per_book on public.loans (book_id) where returned_on is null;
create index if not exists books_owner_id_idx on public.books (owner_id);
create index if not exists loans_owner_id_idx on public.loans (owner_id);

alter table public.books enable row level security;
alter table public.loans enable row level security;

-- Signed-out visitors get nothing.
revoke all on public.books, public.loans from anon;

drop policy if exists "Owners manage their books" on public.books;
create policy "Owners manage their books" on public.books
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "Owners manage their loans" on public.loans;
create policy "Owners manage their loans" on public.loans
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.books b where b.id = book_id and b.owner_id = (select auth.uid()))
  );
