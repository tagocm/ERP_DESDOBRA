-- Create cfop table
CREATE TABLE IF NOT EXISTS public.cfop (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo text NOT NULL,
    descricao text NOT NULL,
    tipo_operacao text NOT NULL CHECK (tipo_operacao IN ('entrada', 'saida')),
    ambito text NOT NULL CHECK (ambito IN ('estadual', 'interestadual', 'exterior')),
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT cfop_codigo_key UNIQUE (codigo),
    CONSTRAINT cfop_codigo_check CHECK (codigo ~ '^\d{4}$')
);

-- RLS Policies
ALTER TABLE public.cfop ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (authenticated and anon if needed, usually auth for ERP)
CREATE POLICY "Enable read access for all users" ON public.cfop
    FOR SELECT USING (true);

-- Allow write access only to admins/service_role (assuming service_role bypasses RLS, but for seed script using service key it works. 
-- For admin users via UI (if ever needed), we might need a specific policy. 
-- User said "somente admin/super-admin" for technical panel.
-- For now, let's allow insert/update for authenticated users with a specific role check if existing roles exist, or just service_role for now if no UI.)
-- Actually user says "Não criar CRUD aberto para usuário comum".
-- So I will restricting write to service_role or admin.
-- Assuming 'company_members' table has roles. I'll leave write constrained to postgres level or specifically admins if I knew the role structure.
-- Given previous task context (fiscal operations), I'll stick to basic read-only for now for users.
-- The seed script will likely use the service_role key which bypasses RLS.

-- Trigger for updated_at
CREATE TRIGGER update_cfop_updated_at
    BEFORE UPDATE ON public.cfop
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
