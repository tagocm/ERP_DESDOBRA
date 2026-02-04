-- P1: Align sales_rep_id FK to public.users (for PostgREST embeds)

BEGIN;

DO $$
DECLARE
    v_constraint text;
BEGIN
    -- Drop FK pointing to auth.users if present
    SELECT tc.constraint_name INTO v_constraint
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'sales_documents'
      AND kcu.column_name = 'sales_rep_id'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
    LIMIT 1;

    IF v_constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.sales_documents DROP CONSTRAINT %I', v_constraint);
    END IF;

    -- Ensure FK to public.users exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = 'sales_documents'
          AND kcu.column_name = 'sales_rep_id'
          AND ccu.table_schema = 'public'
          AND ccu.table_name = 'users'
    ) THEN
        ALTER TABLE public.sales_documents
            ADD CONSTRAINT sales_documents_sales_rep_id_public_users_fkey
            FOREIGN KEY (sales_rep_id)
            REFERENCES public.users(id);
    END IF;
END $$;

COMMIT;
