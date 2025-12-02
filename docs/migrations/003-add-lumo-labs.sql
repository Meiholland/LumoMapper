-- Migration: Add Lumo Labs to companies table

insert into public.companies (name)
values ('Lumo Labs')
on conflict (name) do nothing;

