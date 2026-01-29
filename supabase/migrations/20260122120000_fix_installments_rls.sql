-- Enable update for authenticated users on financial_event_installments
create policy "Enable update for users" on "public"."financial_event_installments"
for update
to authenticated
using (true)
with check (true);

-- Also enable insert just in case (though we are updating likely)
create policy "Enable insert for users" on "public"."financial_event_installments"
for insert
to authenticated
with check (true);
