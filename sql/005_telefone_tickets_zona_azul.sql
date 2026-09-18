-- Necessário para o envio de notificações via WhatsApp (confirmação de
-- pagamento e alerta anti-multa). Nullable: nem todo ticket precisa vir com
-- telefone (compatibilidade com integrações que não o coletam).
alter table public.tickets_zona_azul
  add column if not exists telefone text;

create index if not exists idx_tickets_zona_azul_telefone on public.tickets_zona_azul (telefone);
