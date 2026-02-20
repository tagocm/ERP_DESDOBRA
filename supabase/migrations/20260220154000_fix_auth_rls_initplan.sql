-- fix_auth_rls_initplan
-- Objetivo: eliminar warning 0003 (auth_rls_initplan) sem mudar regra de acesso.
-- Estratégia: recriar policies do schema public que usam auth.uid()/current_setting()
-- diretamente, substituindo por (select auth.uid())/(select current_setting(...)).

BEGIN;

DO $$
DECLARE
  p RECORD;
  role_clause TEXT;
  qual_new TEXT;
  with_check_new TEXT;
  create_stmt TEXT;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual, '') LIKE '%auth.uid()%'
        OR COALESCE(with_check, '') LIKE '%auth.uid()%'
        OR COALESCE(qual, '') LIKE '%current_setting(%'
        OR COALESCE(with_check, '') LIKE '%current_setting(%'
      )
  LOOP
    -- Preserve role target list exactly
    IF array_position(p.roles, 'public') IS NOT NULL AND cardinality(p.roles) = 1 THEN
      role_clause := 'PUBLIC';
    ELSIF array_position(p.roles, 'public') IS NOT NULL THEN
      SELECT 'PUBLIC, ' || string_agg(quote_ident(r), ', ')
      INTO role_clause
      FROM unnest(p.roles) AS r
      WHERE r <> 'public';
    ELSE
      SELECT string_agg(quote_ident(r), ', ')
      INTO role_clause
      FROM unnest(p.roles) AS r;
    END IF;

    qual_new := COALESCE(p.qual, '');
    with_check_new := COALESCE(p.with_check, '');

    -- Avoid double-wrapping existing SELECT forms
    qual_new := replace(qual_new, '(select auth.uid())', '__AUTH_UID_SELECTED__');
    with_check_new := replace(with_check_new, '(select auth.uid())', '__AUTH_UID_SELECTED__');
    qual_new := replace(qual_new, 'auth.uid()', '(select auth.uid())');
    with_check_new := replace(with_check_new, 'auth.uid()', '(select auth.uid())');
    qual_new := replace(qual_new, '__AUTH_UID_SELECTED__', '(select auth.uid())');
    with_check_new := replace(with_check_new, '__AUTH_UID_SELECTED__', '(select auth.uid())');

    qual_new := replace(qual_new, '(select current_setting(', '__CURRENT_SETTING_SELECTED__(');
    with_check_new := replace(with_check_new, '(select current_setting(', '__CURRENT_SETTING_SELECTED__(');
    qual_new := replace(qual_new, 'current_setting(', '(select current_setting(');
    with_check_new := replace(with_check_new, 'current_setting(', '(select current_setting(');
    qual_new := replace(qual_new, '__CURRENT_SETTING_SELECTED__(', '(select current_setting(');
    with_check_new := replace(with_check_new, '__CURRENT_SETTING_SELECTED__(', '(select current_setting(');

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);

    create_stmt := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      p.policyname,
      p.schemaname,
      p.tablename,
      p.permissive,
      p.cmd,
      role_clause
    );

    IF qual_new <> '' THEN
      create_stmt := create_stmt || format(' USING (%s)', qual_new);
    END IF;

    IF with_check_new <> '' THEN
      create_stmt := create_stmt || format(' WITH CHECK (%s)', with_check_new);
    END IF;

    EXECUTE create_stmt;
  END LOOP;
END
$$;

COMMIT;
