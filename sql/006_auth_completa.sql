-- Suporte à autenticação completa: papel ADMINISTRADOR, ativação/desativação
-- de contas (verificada a cada login e a cada checagem de sessão) e colunas
-- reservadas para os fluxos futuros de recuperação de senha e convite de
-- usuários (endpoints ainda não implementados — ver AUTENTICACAO.md).
alter table public.usuarios
  add column if not exists ativo boolean not null default true,
  add column if not exists reset_senha_token text,
  add column if not exists reset_senha_expira_em timestamptz,
  add column if not exists convite_token text,
  add column if not exists convite_expira_em timestamptz;

-- Um usuário convidado (fluxo futuro) começa sem senha até aceitar o convite.
alter table public.usuarios alter column senha_hash drop not null;

alter table public.usuarios
  drop constraint if exists usuarios_role_check,
  add constraint usuarios_role_check
    check (role in ('MOTORISTA', 'FISCAL', 'GESTOR_PUBLICO', 'ADMINISTRADOR'));

create unique index if not exists idx_usuarios_reset_senha_token
  on public.usuarios (reset_senha_token) where reset_senha_token is not null;

create unique index if not exists idx_usuarios_convite_token
  on public.usuarios (convite_token) where convite_token is not null;
