-- Enable RLS on core tables if not already enabled
alter table public.sales enable row level security;
alter table public.installments enable row level security;

alter table public.sale_items enable row level security;
alter table public.sale_documents enable row level security;

-- Helper function to get current user's branch_id
create or replace function get_user_branch_id()
returns bigint as $$
  select branch_id from public.profiles where id = auth.uid();
$$ language sql security definer stable;

-- SALES: Isolation Policy
drop policy if exists "Branch Isolation Policy" on public.sales;
create policy "Branch Isolation Policy" on public.sales
for all
using (
  -- If user has a branch, they can only see/edit their branch's sales
  (get_user_branch_id() is not null and branch_id = get_user_branch_id())
  OR
  -- If user has NO branch (Admin), they can see EVERYTHING
  (get_user_branch_id() is null)
);

-- INSTALLMENTS: Inherit from Sales
drop policy if exists "Branch Isolation Policy" on public.installments;
create policy "Branch Isolation Policy" on public.installments
for all
using (
  exists (
    select 1 from public.sales
    where sales.id = installments.sale_id
  )
);



-- SALE ITEMS
drop policy if exists "Branch Isolation Policy" on public.sale_items;
create policy "Branch Isolation Policy" on public.sale_items
for all
using (
  exists (
    select 1 from public.sales
    where sales.id = sale_items.sale_id
  )
);
