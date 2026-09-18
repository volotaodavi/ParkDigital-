-- Controla o ciclo de vida do ticket: reservado (aguardando confirmação do
-- gateway de pagamento) x efetivamente ativo na vaga.
alter table public.tickets_zona_azul
  add column if not exists status text not null default 'PENDENTE_PAGAMENTO'
    check (status in ('PENDENTE_PAGAMENTO', 'ATIVO'));

-- Acelera a busca do webhook (status + placa/id) e do cron de alertas (status + data_expiracao)
create index if not exists idx_tickets_zona_azul_status_expiracao
  on public.tickets_zona_azul (status, data_expiracao);
