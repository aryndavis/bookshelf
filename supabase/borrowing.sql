-- Books you're borrowing from someone else (a friend, the public library). Run once after schema.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run. It's safe to run again.
-- Private like loans: only the signed-in owner can see or change them; visitors get nothing.

create table if not exists public.borrowings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  author text not null default '' check (char_length(author) <= 300),
  -- Who or where it's from: "Maya", "Brooklyn Public Library".
  lender text not null check (char_length(lender) between 1 and 120),
  borrowed_on date not null default current_date,
  due_on date,
  returned_on date,
  cover_color text not null default 'pink'
    check (cover_color in ('pink', 'peach', 'yellow', 'mint', 'sky', 'lilac', 'wine', 'navy', 'forest', 'cream')),
  cover_pattern text not null default 'plain'
    check (cover_pattern in ('plain', 'stripes', 'dots', 'stars', 'hearts', 'checks', 'waves')),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (due_on is null or due_on >= borrowed_on),
  check (returned_on is null or returned_on >= borrowed_on)
);

create index if not exists borrowings_owner_id_idx on public.borrowings (owner_id);

alter table public.borrowings enable row level security;
revoke all on public.borrowings from anon;

drop policy if exists "Owners manage their borrowings" on public.borrowings;
create policy "Owners manage their borrowings" on public.borrowings
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
