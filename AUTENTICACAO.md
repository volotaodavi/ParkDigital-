# Sistema de Autenticação — ParkDigital

> Documenta o que foi implementado para fechar os itens 3 ("Autenticação/Autorização") e parte do 15 ("Segurança") da `AUDITORIA_TECNICA.md`, sem alterar nenhuma regra de negócio existente (motorista, fiscal, pagamentos, WhatsApp, cron seguem exatamente como estavam).

## O que existia antes

O backend já tinha `POST /auth/login` (bcrypt + JWT) e `authMiddleware`/`checkRole` protegendo rotas. **O que faltava** era o frontend inteiro (não existia tela de login, nem forma de guardar/limpar sessão, nem proteção de rota) e alguns endurecimentos de segurança no backend (rate limiting, ativação/desativação de conta, papel de administrador, renovação de sessão).

## O que foi implementado

### Backend

| Arquivo | Mudança |
|---|---|
| `src/config/authMiddleware.ts` | Adiciona o papel `ADMINISTRADOR`; inclui `nome` (opcional) no payload do JWT; diferencia erro de **token expirado** (`TOKEN_EXPIRADO`) de **token inválido** (`TOKEN_INVALIDO`) — cada um com um `codigo` próprio na resposta, para o frontend reagir de forma específica. |
| `src/config/rateLimit.ts` (novo) | Limita `/auth/login` a 5 tentativas por IP a cada 15 minutos (`express-rate-limit`). Responde `429` com `codigo: "MUITAS_TENTATIVAS"` e loga o IP bloqueado. |
| `src/modules/auth/authManager.ts` | Login agora: (a) usa o rate limiter; (b) valida tamanho máximo dos campos; (c) rejeita contas com `ativo = false` (`403 CONTA_DESATIVADA`), sem revelar se a conta existe para senha errada / identificador inexistente (continuam retornando a mesma resposta `401 CREDENCIAIS_INVALIDAS`, preservando a proteção contra enumeração já existente). Três rotas novas: `GET /auth/me` (confirma que a sessão ainda é válida **e** que a conta segue ativa no banco — não só que o JWT não expirou), `POST /auth/refresh` (emite um novo token, também checando `ativo`) e `POST /auth/logout` (registra o evento no log; ver limitação abaixo). |
| `src/server.ts` | Adiciona `app.set('trust proxy', 1)` — sem isso, o rate limiter enxergaria o IP do proxy do Render para todo mundo, e não o IP real de cada cliente. |
| `sql/006_auth_completa.sql` (novo) | Coluna `ativo` (boolean, default `true`) em `usuarios`; atualiza a restrição de `role` para incluir `ADMINISTRADOR`; adiciona colunas **reservadas** `reset_senha_token`, `reset_senha_expira_em`, `convite_token`, `convite_expira_em` e torna `senha_hash` opcional (ver seção "Preparado para o futuro" abaixo). |

### Frontend (`parkdigital-frontend/`)

| Arquivo | Mudança |
|---|---|
| `src/lib/auth.ts` | Reescrito: agora guarda `{ token, usuario: { id, nome, role } }` como uma sessão única (`salvarSessao`/`obterSessao`/`limparSessao`), com o mapa `CAMINHO_POR_ROLE` usado para redirecionar cada papel para sua página. |
| `src/lib/apiFetch.ts` (novo) | `fetchAutenticado()` — wrapper de `fetch` que anexa o `Authorization: Bearer` automaticamente e lança `SessaoInvalidaError` quando o backend responde 401 (a sessão local já é limpa nesse momento). |
| `src/lib/AuthContext.tsx` (novo) | Contexto React com `sessao`, `login()`, `logout()`; renova a sessão automaticamente a cada 30 minutos chamando `/auth/refresh` em segundo plano, sem interromper o uso. |
| `src/components/RequireAuth.tsx` (novo) | Componente de proteção de rota: sem sessão → `/login`; papel não permitido → home do próprio papel; sessão inválida/expirada (confirmado contra `/auth/me`, não só localmente) → `/login?motivo=sessao_expirada`. |
| `src/app/login/page.tsx` (novo) | Tela de login responsiva, com mensagens de erro específicas por caso (credenciais inválidas, conta desativada, muitas tentativas, erro genérico) e aviso quando a sessão expirou. |
| `src/app/admin/page.tsx` (novo) | Placeholder do painel do administrador (protegido por `RequireAuth`) — a administração da plataforma em si (item 21 da auditoria) continua fora do escopo desta tarefa. |
| `src/app/fiscal/page.tsx`, `src/app/governo/page.tsx` | Passam a exigir login (`RequireAuth allowedRoles={[...]}`) e ganham um botão "Sair" no cabeçalho. A emissão de infração no `/fiscal` agora usa `fetchAutenticado` em vez de anexar o token manualmente. **Nenhuma lógica de negócio dessas páginas foi alterada** (consulta de placa, dados do dashboard do governo continuam exatamente como estavam). |
| `src/app/layout.tsx` | Envolve a aplicação inteira com `<AuthProvider>`. |
| `src/app/page.tsx` | Ganha um 4º card ("Sou administrador") apontando para `/admin`. |

## Decisões de arquitetura (e por que)

1. **Token em `localStorage`, não em cookie `httpOnly`.** Cookie `httpOnly` seria mais resistente a XSS, mas o frontend (Vercel) e o backend (Render) vivem em domínios diferentes — isso tornaria o cookie *cross-site*, exigindo `SameSite=None` e ficando sujeito ao bloqueio crescente de cookies de terceiros pelos navegadores (Safari ITP, Chrome). Manter `Authorization: Bearer` com o token em `localStorage` é o padrão mais confiável para essa topologia (frontend e backend em domínios separados), ao custo de exposição a XSS — mitigado pelo token expirar em poucas horas (`JWT_EXPIRES_IN`) e pelo React já escapar JSX por padrão.
2. **`/fiscal` e `/governo` passaram a exigir login já na entrada da página.** Antes, a consulta de placa era pública e só a emissão de infração/auditoria exigia token — o usuário só descobria isso ao tentar enviar o formulário e levar um 401. Com a tela de login pronta, exigir autenticação já na entrada da página é mais claro e não regride nenhuma regra do backend (a consulta de placa continua uma rota pública lá).
3. **Logout é, na prática, do lado do cliente.** Como o JWT é *stateless* (sem armazenamento de sessão no servidor), não existe hoje uma lista de revogação — `POST /auth/logout` apenas registra o evento em log. Um token roubado antes do logout continua válido até expirar. Se isso vier a ser um requisito real, a solução é uma tabela de tokens revogados (ou trocar para tokens de vida curta + refresh token rotativo armazenado no banco) — deliberadamente fora do escopo desta tarefa por ser uma mudança de arquitetura maior.
4. **`/auth/me` consulta o banco, não só decodifica o JWT.** Isso é o que faz a desativação de uma conta (`ativo = false`) surtir efeito imediato, em vez de esperar até 8h (validade padrão do token) para o usuário ser realmente bloqueado.

## Estrutura preparada para o futuro (não implementada agora)

Conforme pedido, a tarefa **não** incluiu recuperação de senha, alteração de senha, convite de usuários ou uma tela de gestão de ativação/desativação — mas a migration `sql/006_auth_completa.sql` já prepara o terreno:

- `usuarios.ativo` — **já funciona hoje** (checado no login e no `/me`); falta só a tela/endpoint para um admin alternar esse valor.
- `usuarios.reset_senha_token` / `reset_senha_expira_em` — colunas prontas para um futuro fluxo de "esqueci minha senha" (endpoint que gera o token, envia por e-mail/SMS, e um endpoint que valida o token e grava a nova senha). Nenhum e-mail é enviado hoje — não existe provedor de e-mail configurado no projeto.
- `usuarios.convite_token` / `convite_expira_em` + `senha_hash` agora aceita `null` — prontos para um futuro fluxo de convite (criar a linha do usuário sem senha, mandar um link com o token, o convidado define a senha ao aceitar).

Nenhum endpoint desses foi criado — só o schema, para não fabricar funcionalidade que pareça existir sem existir de verdade.

## Testes realizados

- **Backend**, com Supabase substituído por um mock em memória (`require.cache`) rodando o Express real compilado: login com credenciais corretas, senha errada, identificador inexistente (mesma resposta que senha errada — sem enumeração), conta desativada (`403`), `/me` com token válido e sem token, `/refresh`, expiração real de token (`JWT_EXPIRES_IN=2s` para o teste) gerando `401 TOKEN_EXPIRADO`, logout, e rate limiting disparando `429` na 6ª tentativa de login em 15 minutos.
- **Frontend + backend juntos, no Chromium via Playwright** (`npm run dev` dos dois lados de verdade, sem nada simulado na camada HTTP): acessar `/fiscal` sem login redireciona para `/login`; login como `FISCAL` leva a `/fiscal` e mostra o nome no cabeçalho; tentar acessar `/governo` logado como `FISCAL` redireciona de volta para `/fiscal` (proteção por papel); logout limpa o `localStorage` e volta para `/login`; login como `GESTOR_PUBLICO` leva a `/governo`; a sessão sobrevive a um F5 (reload); senha errada mostra "Credenciais inválidas" na tela.
- `tsc --noEmit`, `npm run build` (backend e frontend) e `npm run lint` (frontend) — todos limpos.

## Como testar manualmente

```bash
# 1. Aplicar a migration nova no Supabase (na ordem, depois das anteriores)
#    sql/006_auth_completa.sql

# 2. Provisionar um usuário de teste
npm run hash-senha -- "minha-senha"
# INSERT INTO usuarios (identificador, nome, senha_hash, role) VALUES ('fiscal001', 'Teste', '<hash>', 'FISCAL');

# 3. Backend
cp .env.example .env   # preencher SUPABASE_URL/KEY, JWT_SECRET
npm start              # porta 4000

# 4. Frontend
cd parkdigital-frontend
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev            # porta 3000, acessar /login
```
