-- Trigger: Prevent deletion of PAID installments
create or replace function check_installment_deletion()
returns trigger as $$
begin
  if old.is_paid = true then
    raise exception 'Cannot delete an installment that has already been paid (ID: %)', old.id;
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists prevent_paid_installment_delete on public.installments;
create trigger prevent_paid_installment_delete
before delete on public.installments
for each row execute procedure check_installment_deletion();


-- Trigger: Prevent modification of PAID installments (amount/date)
create or replace function check_installment_update()
returns trigger as $$
begin
  if old.is_paid = true and (new.amount <> old.amount or new.due_date <> old.due_date) then
    raise exception 'Cannot modify amount or date of a paid installment (ID: %)', old.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists prevent_paid_installment_update on public.installments;
create trigger prevent_paid_installment_update
before update on public.installments
for each row execute procedure check_installment_update();
