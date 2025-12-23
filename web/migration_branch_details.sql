-- Add columns to branches table for Invoice Details
alter table branches 
add column if not exists address text,
add column if not exists phone text,
add column if not exists wilaya text;

-- Add comment
comment on column branches.address is 'Full address of the branch';
comment on column branches.phone is 'Contact phone number';
