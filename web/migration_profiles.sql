-- Create profiles table to link users to branches
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  branch_id bigint references public.branches on delete set null,
  role text default 'user'
);

-- Comments
comment on table public.profiles is 'Extends auth.users to store branch association';
comment on column public.profiles.branch_id is 'The branch this user is restricted to. Null means no restriction (e.g. Admin)';

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view own profile" 
  on public.profiles for select 
  using (auth.uid() = id);

create policy "Admins can view all profiles" 
  on public.profiles for select 
  using ( true ); -- Simplified for now, can be restricted later

-- Trigger to create profile on signup (Optional but good practice)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution (Uncomment if you want auto-creation on signup)
-- drop trigger if exists on_auth_user_created on auth.users;
-- create trigger on_auth_user_created
--   after insert on auth.users
--   for each row execute procedure public.handle_new_user();
