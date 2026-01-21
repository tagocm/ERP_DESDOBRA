-- Verificação das tabelas e colunas que estão causando erro 400
-- Execute este script no SQL Editor do Supabase

DO $$
DECLARE
    missing_tables text := '';
    missing_columns text := '';
BEGIN
    -- 1. Verificar tabela payment_modes
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_modes') THEN
        missing_tables := missing_tables || ' payment_modes';
    ELSE
        -- Se existe, verificar colunas
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_modes' AND column_name = 'name') THEN
            missing_columns := missing_columns || ' payment_modes.name';
        END IF;
         IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'payment_modes' AND column_name = 'company_id') THEN
            missing_columns := missing_columns || ' payment_modes.company_id';
        END IF;
    END IF;

     -- 2. Verificar tabela price_tables
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'price_tables') THEN
        missing_tables := missing_tables || ' price_tables';
    END IF;

     -- 3. Verificar tabela payment_terms
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_terms') THEN
        missing_tables := missing_tables || ' payment_terms';
    END IF;
    
    RAISE NOTICE '---------------------------------------------------';
    RAISE NOTICE 'RELATÓRIO DE INTEGRIDADE:';
    IF missing_tables = '' AND missing_columns = '' THEN
        RAISE NOTICE 'SUCESSO: Todas as tabelas e colunas esperadas existem.';
    ELSE
        IF missing_tables <> '' THEN
            RAISE NOTICE 'ERRO: Tabelas faltando:%', missing_tables;
        END IF;
        IF missing_columns <> '' THEN
            RAISE NOTICE 'ERRO: Colunas faltando:%', missing_columns;
        END IF;
    END IF;
    RAISE NOTICE '---------------------------------------------------';
END $$;

-- Forçar reload do cache do schema (caso as tabelas existam mas o PostgREST não saiba)
NOTIFY pgrst, 'reload schema';
