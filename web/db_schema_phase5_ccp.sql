-- Phase 5: Automated Postal Withdrawals (CCP)

-- 1. Contracts Table (Types: 1 or 30)
create table contracts (
  id uuid default uuid_generate_v4() primary key,
  type integer not null check (type in (1, 30)),
  name text not null, -- e.g. "Contract 01", "Contract 30"
  company_id uuid, -- Optional link if you have multiple internal companies
  withdrawal_day integer default 1 check (withdrawal_day between 1 and 31),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default contracts
insert into contracts (type, name, withdrawal_day) values (1, 'Contrat Type 01', 5);
insert into contracts (type, name, withdrawal_day) values (30, 'Contrat Type 30', 20);


-- 2. Payment References (The core entity for CCP)
create table payment_references (
  id uuid default uuid_generate_v4() primary key,
  sale_id bigint references sales(id) on delete cascade not null, -- FIXED: Changed uuid to bigint
  reference_code text not null unique,
  amount numeric not null check (amount >= 500),
  start_month date not null,
  end_month date not null,
  status text default 'active' check (status in ('active', 'stopped', 'completed')),
  contract_id uuid references contracts(id), -- Link to contract type
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Update Installments to link to Reference
alter table installments 
add column reference_id uuid references payment_references(id) on delete set null;

alter table installments
add column postal_status integer default -1; 
-- postal_status meanings:
-- -1: Not processed / Manual
-- 0: Success (Green)
-- 1: Waiting Balance (Red)
-- 2: Blocked/Account Closed (Black)

-- 4. Indexes for performance
create index idx_payment_references_sale_id on payment_references(sale_id);
create index idx_payment_references_code on payment_references(reference_code);
create index idx_installments_reference_id on installments(reference_id);
