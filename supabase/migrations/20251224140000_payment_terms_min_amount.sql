
alter table payment_terms 
add column if not exists min_installment_amount numeric(10,2);
