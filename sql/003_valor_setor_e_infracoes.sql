-- Necessário para a auditoria financeira (arrecadação diária e por setor)
alter table public.tickets_zona_azul
  add column if not exists valor numeric(10, 2) not null default 0,
  add column if not exists setor text not null default 'NAO_INFORMADO';

create index if not exists idx_tickets_zona_azul_status_ativacao
  on public.tickets_zona_azul (status, data_ativacao);

-- Registro de multas emitidas pelo fiscal em campo
create table if not exists public.infracoes_zona_azul (
  id uuid primary key default gen_random_uuid(),
  placa text not null,
  localizacao_rua text not null,
  foto_comprovante_url text not null,
  observacao text,
  status text not null default 'AGUARDANDO_EMISSAO_NOTIFICACAO',
  data_emissao timestamptz not null default now()
);

create index if not exists idx_infracoes_zona_azul_placa on public.infracoes_zona_azul (placa);
