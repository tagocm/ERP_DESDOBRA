
alter table "companies" 
add column if not exists "is_branch" boolean default false;

comment on column "companies"."is_branch" is 'Indica se a empresa é uma filial';
