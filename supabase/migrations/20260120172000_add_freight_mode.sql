
alter table "sales_documents" 
add column if not exists "freight_mode" text default null;

alter table "sales_documents"
add column if not exists "route_tag" text default null;

comment on column "sales_documents"."freight_mode" is 'CIF, FOB, EXW, etc.';
comment on column "sales_documents"."route_tag" is 'Região ou rota (ex: SP-CAPITAL, INTERIOR)';
