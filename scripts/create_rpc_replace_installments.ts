
import { createAdminClient } from '@/lib/supabaseServer';

const rpcSql = `
create or replace function replace_event_installments(
  p_event_id uuid,
  p_installments jsonb
) returns void as $$
begin
  -- Delete existing installments for this event
  delete from financial_event_installments where event_id = p_event_id;
  
  -- Insert new installments if provided
  if jsonb_array_length(p_installments) > 0 then
    insert into financial_event_installments (
      event_id, 
      installment_number, 
      due_date, 
      amount, 
      payment_method, 
      payment_condition,
      financial_account_id,
      suggested_account_id,
      cost_center_id,
      notes
    )
    select 
      p_event_id,
      (x->>'installment_number')::int,
      (x->>'due_date')::date,
      (x->>'amount')::numeric,
      (x->>'payment_method'),
      (x->>'payment_condition'),
      (x->>'financial_account_id')::uuid,
      (x->>'suggested_account_id')::uuid,
      (x->>'cost_center_id')::uuid,
      (x->>'notes')
    from jsonb_array_elements(p_installments) x;
  end if;
end;
$$ language plpgsql;
`;

async function applyMigration() {
  const supabase = await createAdminClient();
  const { error } = await supabase.rpc('exec_sql', { sql: rpcSql });
  // Note: exec_sql might not exist if not enabled. 
  // If not, we can try direct SQL execution if available or assume console access.
  // Assuming standard Supabase setup allows SQL via dashboard, but here we need a way.
  // If 'exec_sql' is missing, we might fail.
  // Alternative: Use a known "apply migration" pattern for this project.
  // Checking previous steps, the user has 'scripts/apply-migration.ts'. I should check that.

  if (error) {
    console.error("RPC creation failed:", error);
    // Fallback: try raw query? No client-side raw query.
  } else {
    console.log("RPC 'replace_event_installments' created successfully.");
  }
}
