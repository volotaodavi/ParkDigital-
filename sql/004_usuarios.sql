-- Contas de acesso para o login (JWT). Fiscais e gestores públicos são
-- provisionados manualmente pela equipe de TI (não há auto-cadastro).
create table if not exists public.usuarios (
  id uuid primary key default gen_random_uuid(),
  identificador text not null unique, -- CPF (motorista) ou matrícula funcional (fiscal/gestor)
  nome text not null,
  senha_hash text not null,
  role text not null check (role in ('MOTORISTA', 'FISCAL', 'GESTOR_PUBLICO')),
  criado_em timestamptz not null default now()
);

create index if not exists idx_usuarios_identificador on public.usuarios (identificador);

-- Exemplo de provisionamento manual (gere o hash com `npm run hash-senha -- "sua-senha"`):
-- insert into public.usuarios (identificador, nome, senha_hash, role)
-- values ('fiscal001', 'Fiscal de Teste', '<hash-gerado>', 'FISCAL');
