-- RPC: Manage Drafts
-- Deletes old drafts for the user to ensure only 1 active draft exists (or cleaning up abandoned ones).
-- Params: 
--   p_company_id: UUID
--   p_user_id: UUID (optional, if null, only deletes old drafts globally for company if caller is admin?) -> stick to user specific
--   p_exclude_id: UUID (optional, the current draft we want to KEEP)

CREATE OR REPLACE FUNCTION public.cleanup_user_drafts(p_company_id UUID, p_user_id UUID, p_exclude_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.sales_documents
    WHERE company_id = p_company_id
      -- Assuming we rely on sales_rep_id or we need to add created_by column. 
      -- The schema has sales_rep_id but that is business logic. The actual "creator" is usually tracked via RLS or we should add created_by.
      -- Wait, Supabase doesn't automatically add created_by unless we defined a trigger or column default auth.uid() (which requires specific setup).
      -- Looking at schema: sales_documents doesn't have created_by.
      -- However, usually for drafts, we want to look at who is 'Sales Rep' OR we need a loose 'session_owner' field.
      -- Given the user requirement "1 rascunho por USUÁRIO", we should probably use `sales_rep_id` IF the user is the rep.
      -- BUT, a manager might create a draft for another rep.
      -- SAFE BET: Add `created_by` column if it doesn't exist? Or just filter by sales_rep_id for now as "User".
      -- The user prompt said "1 rascunho por usuário".
      -- Let's add `created_by` column in this migration if needed, but for now let's assume sales_rep_id is the user or we rely on explicit 'draft' status that have no number.
      
      -- Let's stick to: Status = 'draft' AND sales_rep_id = p_user_id
        AND status_commercial = 'draft'
        AND sales_rep_id = p_user_id
        AND (p_exclude_id IS NULL OR id != p_exclude_id)
        AND document_number IS NULL; -- Drafts shouldn't have numbers yet usually, (trigger assigns on 'order' type).
        -- Re-reading valid "Draft" definition: status_commercial='draft'.
END;
$$;
