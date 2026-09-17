# Relatório do Projeto — ParkDigital

> Documento de handoff técnico. Escrito para dar contexto completo a quem for continuar o desenvolvimento (humano ou outra IA), sem precisar reconstruir o histórico de decisões a partir do zero.

## O que é a ParkDigital

A ParkDigital é uma startup GovTech que digitaliza o **estacionamento rotativo (Zona Azul)** de municípios brasileiros. Em vez de parquímetros físicos ou talões de papel, o motorista ativa e paga a vaga pelo celular via Pix, o fiscal de trânsito consulta a regularidade da placa em tempo real pelo celular (em vez de talão), e a prefeitura (Secretaria de Fazenda/Trânsito) enxerga a arrecadação e a fiscalização em um painel único, em tempo real.

O modelo de negócio (ver `PROPOSTA_COMERCIAL.md`) é vender isso para prefeituras via contratação simplificada (Marco Legal das Startups / dispensa de licitação), cobrando por assinatura fixa mensal **ou** por uma taxa sobre o volume de Pix transacionado (risco zero para o município).

## Estrutura do repositório (monorepo)

```
ParkDigital- (raiz = backend Node.js/Express/TypeScript)
├── src/                        # backend
│   ├── config/                 # env, Supabase, JWT, cron, WhatsApp
│   ├── modules/
│   │   ├── auth/                # login (emite JWT)
│   │   ├── driver/               # ativação de vaga + webhook de pagamento
│   │   ├── fiscal/               # consulta de placa + emissão de infração
│   │   └── governo/              # auditoria financeira
│   ├── types/                  # tipos compartilhados (TicketZonaAzul)
│   ├── server.ts                # processo da API HTTP
│   └── worker.ts                # processo separado só do cron
├── sql/                         # migrations incrementais (001 a 005)
├── scripts/hashSenha.ts         # utilitário pra gerar hash de senha (provisionar usuários)
├── parkdigital-frontend/        # frontend Next.js 15 (App Router, TS, Tailwind)
│   └── src/app/{motorista,fiscal,governo}/page.tsx
├── Dockerfile, docker-compose.yml, render.yaml, .dockerignore
├── .env.example                  # referência de TODAS as variáveis de ambiente
└── PROPOSTA_COMERCIAL.md         # documento comercial/jurídico de vendas
```

## Backend — o que existe e funciona

Tabela `tickets_zona_azul` (Supabase/Postgres): `id, placa, cpf_motorista, minutos_contratados, data_ativacao, data_expiracao, status, valor, setor, telefone`.

| Rota | Método | Protegida por | O que faz |
|---|---|---|---|
| `/health` | GET | — | Healthcheck |
| `/api/v1/auth/login` | POST | — | Valida `identificador`/`senha` contra tabela `usuarios` (bcrypt) e emite JWT `{ sub, role }` |
| `/api/v1/motorista/vaga/ativar` | POST | — | Cria ticket com status `PENDENTE_PAGAMENTO`, gera Pix Copia e Cola simulado, dispara WhatsApp de confirmação (se telefone informado) |
| `/api/v1/payment/webhook` | POST | — | Simula confirmação de pagamento do gateway (Asaas); promove ticket para `ATIVO` e recalcula a janela de tempo a partir da confirmação real |
| `/api/v1/fiscal/placa/consultar/:placa` | GET | — | Retorna `REGULAR` (com minutos restantes) só se houver ticket `ATIVO`, senão `IRREGULAR` |
| `/api/v1/fiscal/infracao/emitir` | POST | JWT role `FISCAL` | Salva multa em `infracoes_zona_azul` |
| `/api/v1/governo/auditoria/arrecadacao` | GET | JWT role `GESTOR_PUBLICO` | Arrecadação do dia, volume de tickets ativos, relatório por setor |

### Decisões de arquitetura importantes (não óbvias, valem leitura antes de mexer)

1. **Ciclo de vida do ticket em duas fases.** A ativação cria o ticket como `PENDENTE_PAGAMENTO` com `data_ativacao`/`data_expiracao` provisórias. O webhook de pagamento é quem promove para `ATIVO` e **recalcula** essas datas a partir do momento real da confirmação — assim o motorista não perde minutos pagos enquanto o Pix ainda não caiu. A consulta do fiscal só considera `REGULAR` um ticket `ATIVO` (não basta a data bater).
2. **Cron isolado em processo próprio (`src/worker.ts`).** Antes o `node-cron` rodava dentro do `server.ts`. Foi separado porque, se o serviço web escalar para múltiplas réplicas, cada uma dispararia o mesmo alerta duplicado. Consequência prática: **`npm start` sozinho não roda mais o cron** — é preciso rodar `npm start` (API) e `npm run worker` (cron) como processos separados. O `render.yaml` já provisiona os dois serviços.
3. **CORS explícito.** O backend só aceita requisições do frontend cuja origem está em `CORS_ORIGIN`. Sem isso, o navegador bloquearia toda chamada do Next.js.
4. **Não existe endpoint de "status do ticket por id".** O polling do frontend (motorista aguardando confirmação do Pix) reaproveita a consulta pública do fiscal por placa. Funciona, mas é uma gambiarra deliberada — o certo a médio prazo é um endpoint dedicado.
5. **WhatsApp é best-effort e não bloqueia a resposta HTTP.** O envio roda em segundo plano (`void whatsAppService.sendTemplateMessage(...)`), com até 3 tentativas com backoff. Sem `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` configurados, o serviço loga um aviso e não tenta enviar (não derruba o servidor).
6. **Os nomes de template do WhatsApp (`confirmacao_ativacao_pix`, `alerta_vencimento_vaga`) são placeholders.** Para funcionar de verdade, esses templates precisam existir e estar **aprovados** na conta Meta Business Manager — a Cloud API não permite texto livre fora da janela de atendimento de 24h.
7. **Autenticação sem tela de cadastro.** Não existe endpoint de auto-registro de fiscal/gestor — contas são provisionadas manualmente via `npm run hash-senha -- "senha"` + `INSERT` direto na tabela `usuarios` (documentado em `sql/004_usuarios.sql`).

## Frontend — o que existe e funciona

Next.js 15 (App Router) + TypeScript + Tailwind, em `parkdigital-frontend/`.

- **`/motorista`**: formulário (placa mascarada, CPF, tempo) que chama de verdade `POST /vaga/ativar`, faz polling a cada 3s contra a consulta do fiscal até o ticket virar `ATIVO`, e mostra cronômetro oficial da vaga em verde.
- **`/fiscal`**: consulta de placa real via `fetch`; se `IRREGULAR`, abre formulário de infração que também chama a API real (`POST /infracao/emitir`, com `Authorization: Bearer` se houver token em `localStorage` — mas **não existe tela de login no frontend ainda**, então essa chamada vai retornar 401 até isso ser construído).
- **`/governo`**: painel com 3 KPIs, barras por setor e tabela de alertas — **dados 100% mockados** (`setTimeout` simulando um fetch), porque a rota real exige login de `GESTOR_PUBLICO` que o frontend não implementa, e porque "ocupação de vagas" e "infrações do dia" nem existem como campo na API real.
- Upload de foto de infração captura só o **nome do arquivo** — não existe endpoint de upload real (ex: Supabase Storage), então o campo `foto_comprovante_url` recebe um placeholder.

## Infraestrutura de deploy

- **Dockerfile**: build multi-estágio, `node:22-alpine` (Node 20 quebra o `npm ci` com as versões atuais do `@supabase/supabase-js`, que exigem Node ≥22 — isso foi um bug real encontrado e corrigido testando com um daemon Docker de verdade), roda como usuário não-root.
- **docker-compose.yml**: sobe o backend localmente.
- **render.yaml**: Blueprint com serviço `web` (API) + serviço `worker` (cron), segredos compartilhados via `envVarGroup`.
- **.env.example**: referência única de todas as variáveis, anotando em qual painel cada uma é configurada (Render/Supabase/Vercel).

## O que foi pedido mas AINDA NÃO foi implementado

- **Módulo de vendas/prospecção** (`src/modules/sales/emailTemplates.ts` e `leadSender.ts`): foi pedido explicitamente (gerador de cadências de e-mail para prefeituras + rota `POST /api/v1/sales/prospectar`), mas a tarefa foi interrompida por outras solicitações antes de ser implementada. **Isso é o item pendente mais recente e mais óbvio para continuar.**
- Tela de login no frontend (motorista/fiscal/gestor) — sem ela, as rotas protegidas (infração, auditoria) não são utilizáveis pela interface real.
- Upload real de foto de infração (Supabase Storage ou similar).
- Endpoint dedicado de "status do ticket por id" (hoje é um empréstimo da rota do fiscal).
- Templates do WhatsApp de fato criados e aprovados na Meta Business Manager.
- Testes automatizados (unitários/integração) — o projeto inteiro foi validado manualmente (curl, Playwright, builds reais), não há suíte de testes.

## Como rodar localmente

```bash
# Backend
cp .env.example .env   # preencher SUPABASE_URL/KEY, JWT_SECRET no mínimo
npm install
npm start              # API em PORT (default 4000)
npm run worker         # cron, em outro terminal

# Frontend
cd parkdigital-frontend
cp .env.local.example .env.local   # apontar NEXT_PUBLIC_API_URL pro backend
npm install
npm run dev             # http://localhost:3000
```

As migrations em `sql/001` a `sql/005` precisam ser rodadas em ordem no projeto Supabase antes de qualquer chamada funcionar de verdade.
