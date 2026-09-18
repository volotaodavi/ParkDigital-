-- Tabela principal da Zona Azul Digital
create table if not exists public.tickets_zona_azul (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  cpf_motorista text not null,
  minutos_contratados integer not null check (minutos_contratados > 0),
  data_ativacao timestamptz not null default now(),
  data_expiracao timestamptz not null
);

-- Acelera a busca do fiscal por placa e a ordenação pelo ticket mais recente
create index if not exists idx_tickets_zona_azul_placa on public.tickets_zona_azul (placa);
create index if not exists idx_tickets_zona_azul_expiracao on public.tickets_zona_azul (data_expiracao desc);
