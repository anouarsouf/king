-- Migration: Atomic Reference Generator
-- Function to get the next sequence number for a given prefix

create or replace function get_next_branch_reference(p_prefix text)
returns text
language plpgsql
as $$
declare
  last_code text;
  last_num integer;
  next_code text;
begin
  -- 1. Get the max reference code starting with this prefix
  select reference_code
  into last_code
  from payment_references
  where reference_code ~ ('^' || p_prefix || '[0-9]+$') -- Matches strictly Prefix + Number (e.g. A1, A100)
  order by length(reference_code) desc, reference_code desc
  limit 1;

  -- 2. Extract number and increment
  if last_code is null then
    last_num := 0;
  else
    last_num := replace(last_code, p_prefix, '')::integer;
  end if;

  next_code := p_prefix || (last_num + 1);

  return next_code;
end;
$$;
