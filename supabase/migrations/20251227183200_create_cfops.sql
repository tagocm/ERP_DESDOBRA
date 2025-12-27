-- Create cfops table
create table if not exists cfops (
    code text primary key,
    description text not null,
    is_active boolean default true,
    created_at timestamptz default now()
);

-- Seed initial CFOPs
insert into cfops (code, description) values 
('5101', 'Venda de produção do estabelecimento'),
('5102', 'Venda de mercadoria adquirida ou recebida de terceiros'),
('5103', 'Venda de produção do estabelecimento, efetuada fora do estabelecimento'),
('5104', 'Venda de mercadoria adquirida ou recebida de terceiros, efetuada fora do estabelecimento'),
('5117', 'Venda de mercadoria adquirida ou recebida de terceiros, originada de encomenda para entrega futura'),
('5401', 'Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária'),
('5403', 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária'),
('5405', 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária, na condição de contribuinte substituído'),
('6101', 'Venda de produção do estabelecimento (Interestadual)'),
('6102', 'Venda de mercadoria adquirida ou recebida de terceiros (Interestadual)'),
('6401', 'Venda de produção do estabelecimento em operação com produto sujeito ao regime de substituição tributária (Interestadual)'),
('6403', 'Venda de mercadoria adquirida ou recebida de terceiros em operação com mercadoria sujeita ao regime de substituição tributária (Interestadual)'),
('1201', 'Devolução de venda de produção do estabelecimento'),
('1202', 'Devolução de venda de mercadoria adquirida ou recebida de terceiros'),
('2201', 'Devolução de venda de produção do estabelecimento (Interestadual)'),
('2202', 'Devolução de venda de mercadoria adquirida ou recebida de terceiros (Interestadual)')
on conflict (code) do nothing;

-- Update item_fiscal_profiles to use cfop_code
alter table item_fiscal_profiles 
add column if not exists cfop_code text references cfops(code);

-- Migrate existing valid data (optional, best effort)
update item_fiscal_profiles
set cfop_code = substring(cfop_default from 1 for 4)
where 
    cfop_default is not null 
    and length(cfop_default) >= 4 
    and exists (select 1 from cfops where code = substring(item_fiscal_profiles.cfop_default from 1 for 4));

-- We do not drop cfop_default yet to prevent breaking queries, but eventually it should be removed.
