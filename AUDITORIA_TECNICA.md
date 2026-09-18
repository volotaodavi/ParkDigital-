# Auditoria Técnica Completa — ParkDigital

> Auditoria baseada na leitura integral do código-fonte atual (backend, frontend, SQL e infraestrutura) em `/home/user/ParkDigital-`. Nenhum código foi alterado para produzir este documento. Convenção de status usada em cada item: **FUNCIONAL** (real, ponta a ponta) · **PARCIAL** (funciona, com lacunas) · **SIMULADO** (mock, não persiste/não integra de verdade) · **AUSENTE** (não existe).

---

## 1. Backend

**Status atual:** FUNCIONAL (núcleo) — Node.js + Express + TypeScript estrito, arquitetura modular por domínio (`driver`, `fiscal`, `governo`, `auth`), dois processos separados (API + worker de cron).

**Arquivos:** `src/server.ts`, `src/worker.ts`, `src/config/*`, `src/modules/**`, `src/types/ticket.types.ts`, `tsconfig.json`, `package.json`.

- **O que já funciona:** roteamento Express com middlewares de CORS e JSON; separação clara entre processo HTTP (`server.ts`) e processo de cron (`worker.ts`); tratamento de erro (try/catch) padronizado em toda rota; `tsc --noEmit` limpo em modo `strict`.
- **O que está simulado:** nada no núcleo do backend em si — a simulação está nas integrações externas (Pix, WhatsApp), não na arquitetura do servidor.
- **O que está faltando:** camada de validação de schema (hoje é validação manual campo a campo, repetida em cada rota — funciona, mas não escala bem); não há middleware de rate limiting; não há logger estruturado (só `console.log`/`console.error`); não há endpoint de "status do ticket por id" (o frontend contorna isso reaproveitando a rota do fiscal, ver seção 5).
- **Riscos:** validação manual duplicada tende a divergir entre rotas conforme o projeto cresce; ausência de logger estruturado dificulta observabilidade em produção.
- **Dependências:** nenhuma pendência externa para este item.
- **Prioridade:** MÉDIA (funciona bem para o estágio atual; validação com schema — ex: Zod — e logger estruturado — ex: pino — importam antes de escalar para múltiplos municípios).

---

## 2. Banco de dados

**Status atual:** PARCIAL — schema coerente e versionado incrementalmente, mas **single-tenant** (uma instância Supabase = um município).

**Arquivos:** `sql/001` a `sql/005` (aplicados manualmente, sem ferramenta de migration como Prisma/Knex/Flyway).

- **O que já funciona:** três tabelas (`tickets_zona_azul`, `infracoes_zona_azul`, `usuarios`), índices nos campos de busca mais usados (placa, status+expiração, telefone, identificador), `check constraints` para `status` e `role`, `uuid` como chave primária.
- **O que está simulado:** nada — o schema é real e as migrations rodam de verdade num Postgres/Supabase.
- **O que está faltando:** (a) **nenhuma coluna de município/tenant** em nenhuma tabela — o modelo de negócio (vender para várias prefeituras) exige isso; (b) sem ferramenta de migration versionada (os arquivos `.sql` precisam ser aplicados manualmente e na ordem certa — não há registro de "quais já rodaram"); (c) sem soft-delete/auditoria de alterações (um `UPDATE` na tabela `tickets_zona_azul` não deixa rastro do valor anterior); (d) sem particionamento/retenção de dados históricos.
- **Riscos:** aplicar migration fora de ordem ou esquecer de rodar uma delas quebra o backend silenciosamente (o `env.ts`/queries assumem colunas que talvez não existam ainda); crescimento de dados sem estratégia de arquivamento.
- **Dependências:** decisão de arquitetura multi-tenant (linha `municipio_id` vs. banco por cliente) precisa ser tomada antes do segundo cliente.
- **Prioridade:** CRÍTICA para o modelo de negócio multi-município; MÉDIA para operar com um único cliente piloto.

---

## 3. Autenticação/Autorização

**Status atual:** FUNCIONAL no backend, **AUSENTE** no frontend.

**Arquivos:** `src/modules/auth/authManager.ts`, `src/config/authMiddleware.ts`, `sql/004_usuarios.sql`, `scripts/hashSenha.ts`, `parkdigital-frontend/src/lib/auth.ts`.

- **O que já funciona:** login com `POST /api/v1/auth/login` validando hash bcrypt; comparação de tempo constante mesmo quando o identificador não existe (proteção contra enumeração por timing); JWT `{ sub, role }` assinado com `JWT_SECRET`; `authMiddleware` + `checkRole(roles[])` protegendo rotas por papel (`FISCAL`, `GESTOR_PUBLICO`); provisionamento de conta via script (`npm run hash-senha`) + INSERT manual.
- **O que está simulado:** nada no mecanismo em si — é um JWT real, validado de verdade.
- **O que está faltando:** **tela de login no frontend** (existe só um `obterTokenArmazenado()` lendo `localStorage`, mas nada nunca escreve nesse token — ou seja, hoje é **impossível** um fiscal ou gestor usar as telas protegidas pela interface real); sem rate limiting/bloqueio de tentativas de login (brute force); sem refresh token nem mecanismo de logout/revogação (um JWT vazado continua válido até expirar, até 8h); sem 2FA; sem auto-cadastro (decisão consciente, mas significa que todo onboarding de fiscal/gestor é manual via SQL).
- **Riscos:** sem tela de login, o produto não é usável de ponta a ponta para fiscal/governo hoje. Sem rate limiting, `/auth/login` é alvo fácil de força bruta.
- **Dependências:** nenhuma externa; é trabalho de frontend + endurecimento de backend.
- **Prioridade:** CRÍTICA (tela de login é bloqueador para qualquer uso real por fiscal/gestor).

---

## 4. App do Motorista

**Status atual:** FUNCIONAL (fluxo completo, ponta a ponta, com integrações simuladas onde é esperado).

**Arquivos:** `src/modules/driver/ticketManager.ts`, `src/modules/driver/webhookPayment.ts`, `parkdigital-frontend/src/app/motorista/page.tsx`.

- **O que já funciona:** formulário com máscara de placa/CPF; `fetch` real para `POST /vaga/ativar`; polling real a cada 3s contra o backend; transição automática para tela de sucesso com cronômetro real quando o pagamento é confirmado; cópia do código Pix via `navigator.clipboard`.
- **O que está simulado:** o Pix em si (código Copia e Cola gerado localmente, não é um Pix real registrado no Banco Central); a "confirmação de pagamento" depende de alguém chamar manualmente `POST /payment/webhook` (não há gateway real conectado); QR Code é um ícone, não um QR real gerado a partir do payload Pix.
- **O que está faltando:** gateway de pagamento real (Asaas, Mercado Pago, PSP com Pix nativo); geração de QR Code real (biblioteca tipo `qrcode` a partir do payload EMV); histórico de vagas do motorista (não há "minhas vagas" nem recibo).
- **Riscos:** ver seção 7 (Pagamentos) — o webhook não autenticado é um risco de segurança grave, não só uma limitação funcional.
- **Dependências:** contratação de um PSP/gateway Pix real é pré-requisito para sair do simulado.
- **Prioridade:** CRÍTICA (gateway real) para produção; o restante do fluxo já está pronto.

---

## 5. App do Fiscal

**Status atual:** FUNCIONAL (consulta e emissão de infração), com uma lacuna de dado importante.

**Arquivos:** `src/modules/fiscal/plateScanner.ts`, `src/modules/fiscal/infractionManager.ts`, `parkdigital-frontend/src/app/fiscal/page.tsx`.

- **O que já funciona:** consulta real de placa (`GET /placa/consultar/:placa`) retornando `REGULAR` (com minutos restantes reais) ou `IRREGULAR`; formulário de infração conectado de verdade a `POST /infracao/emitir`, incluindo o header `Authorization` quando há token salvo.
- **O que está simulado:** a foto do comprovante — o input de arquivo captura só o **nome** do arquivo (`pendente-upload://<nome>`), a imagem em si nunca é enviada nem armazenada (ver seção 10).
- **O que está faltando:** sem token de login real (depende da seção 3), toda tentativa de emitir infração hoje retorna 401 na prática; sem geolocalização automática (o fiscal digita a rua manualmente, não captura GPS — ver seção 11); sem histórico de infrações emitidas pelo próprio fiscal; sem modo offline (se o fiscal ficar sem sinal em campo, a consulta/emissão simplesmente falha).
- **Riscos:** sem foto real armazenada, uma infração pode ser contestada legalmente por falta de prova; sem GPS, a localização registrada depende inteiramente da digitação do fiscal (erro humano, fraude).
- **Dependências:** login real (seção 3) e upload de arquivo (seção 10) são pré-requisitos para este módulo funcionar de ponta a ponta em campo.
- **Prioridade:** ALTA.

---

## 6. Dashboard do Governo

**Status atual:** PARCIAL — backend real existe, mas o **frontend não o consome** (100% mockado).

**Arquivos:** `src/modules/governo/dashboardFinanceiro.ts` (backend real) vs. `parkdigital-frontend/src/app/governo/page.tsx` (mock).

- **O que já funciona (backend):** `GET /governo/auditoria/arrecadacao` retorna, de fato, arrecadação do dia, contagem de tickets `ATIVO` e relatório por setor — tudo calculado a partir de dados reais do Supabase, protegido por JWT + role `GESTOR_PUBLICO`.
- **O que está simulado (frontend):** a tela inteira usa uma `Promise` com `setTimeout` retornando números fixos (R$ 4.250,00, 74%, 38 infrações) — **não chama o backend**.
- **O que está faltando:** integração real do frontend com o endpoint (bloqueada pela ausência de login, seção 3); os campos "ocupação de vagas" e "infrações emitidas hoje" nem existem na API real — precisam de endpoints novos; nenhum filtro de período (só "hoje"); nenhuma exportação de dados.
- **Riscos:** um gestor público que abrisse essa tela hoje veria números fictícios sem saber que são fictícios — risco reputacional/de credibilidade se for exposto assim para um cliente real.
- **Dependências:** login real (seção 3); dois endpoints novos (ocupação e infrações do dia) para a tela deixar de precisar de dados inventados.
- **Prioridade:** ALTA.

---

## 7. Pagamentos

**Status atual:** SIMULADO, com uma vulnerabilidade de segurança real no ponto de confirmação.

**Arquivos:** `src/modules/driver/webhookPayment.ts`, `src/modules/driver/ticketManager.ts`.

- **O que já funciona:** a máquina de estados (`PENDENTE_PAGAMENTO` → `ATIVO`) e o recálculo da janela de tempo a partir da confirmação real funcionam corretamente e são desenho sólido.
- **O que está simulado:** o gateway de pagamento não existe — `POST /payment/webhook` simplesmente aceita `id_transacao` ou `placa` e ativa o ticket, **sem validar assinatura, segredo ou origem da requisição**.
- **O que está faltando:** validação de assinatura HMAC do gateway real (todo PSP sério assina o payload do webhook); idempotência explícita (chamar o webhook duas vezes para o mesmo ticket hoje simplesmente reprocessa sem erro, o que é aceitável aqui mas não seria com valores reais em jogo sem um registro de transação separado); conciliação financeira (não existe uma tabela de "transações" separada do ticket — o valor pago vive só dentro do próprio ticket).
- **Riscos:** **CRÍTICO** — qualquer pessoa que descubra a URL do webhook pode ativar qualquer vaga pendente sem pagar nada, bastando saber (ou adivinhar/enumerar) uma placa. Isso não é um risco teórico: é um endpoint público, sem autenticação, que move o sistema para o estado "pago".
- **Dependências:** contrato com gateway real (Asaas, Mercado Pago etc.) definirá o mecanismo de assinatura a validar.
- **Prioridade:** CRÍTICA.

---

## 8. Pix

**Status atual:** SIMULADO.

**Arquivos:** `src/modules/driver/ticketManager.ts` (função `gerarPixCopiaCola`).

- **O que já funciona:** a estrutura do payload segue o formato geral EMV/BR Code (campos, comprimentos) o suficiente para "parecer" um Pix Copia e Cola.
- **O que está simulado:** tudo — não é registrado em nenhum PSP, não pode ser escaneado/pago de verdade, o CRC final é um valor fixo (`63041D3D`), não calculado.
- **O que está faltando:** integração com PSP real (Asaas/Mercado Pago/Efí/Banco do Brasil etc.) para gerar cobrança Pix de verdade com QR Code válido.
- **Riscos:** nenhum risco técnico direto (é claramente identificado como simulação no código), mas é o maior gap entre "demo" e "produto vendável" — sem isso, nenhuma prefeitura arrecada de verdade.
- **Dependências:** decisão comercial de qual PSP integrar (impacta o modelo de precificação da Opção B do `PROPOSTA_COMERCIAL.md`, que depende de uma taxa sobre o Pix real).
- **Prioridade:** CRÍTICA.

---

## 9. WhatsApp

**Status atual:** FUNCIONAL na camada de integração, **bloqueado** por pré-requisito externo (templates não aprovados).

**Arquivos:** `src/config/whatsappClient.ts`, uso em `src/modules/driver/ticketManager.ts` e `src/config/cronTasks.ts`.

- **O que já funciona:** cliente real via `axios` apontando para `https://graph.facebook.com/{versao}/{phone_number_id}/messages` (endpoint correto da Meta Cloud API, validado em teste real contra a API da Meta — retornou erro genuíno de OAuth, confirmando URL/headers corretos); retry com backoff (3 tentativas); nunca derruba o processo chamador; degrada graciosamente (loga aviso e não tenta enviar) se as credenciais não estiverem configuradas.
- **O que está simulado:** nada no código — o bloqueio é externo, não técnico.
- **O que está faltando:** os templates `confirmacao_ativacao_pix` e `alerta_vencimento_vaga` **não existem** na conta Meta Business Manager (são só strings no código) — sem cadastrá-los e aguardar aprovação da Meta, toda chamada falhará em produção; não há webhook de recebimento de status de entrega (delivered/read/failed) — o sistema nunca sabe se a mensagem realmente chegou, só se a chamada HTTP teve sucesso.
- **Riscos:** dependência de aprovação de terceiro (Meta) fora do controle da equipe — pode levar dias; sem webhook de status, alertas "perdidos" silenciosamente (ex: número inválido) não geram nenhum sinal para a operação.
- **Dependências:** conta Meta Business verificada, número de telefone comercial aprovado, templates submetidos e aprovados.
- **Prioridade:** ALTA (o código está pronto; o gargalo é processo externo).

---

## 10. Upload de fotos

**Status atual:** AUSENTE (só a interface existe).

**Arquivos:** `parkdigital-frontend/src/app/fiscal/page.tsx` (captura o nome do arquivo), `src/modules/fiscal/infractionManager.ts` (espera uma URL de string).

- **O que já funciona:** o `<input type="file">` no frontend captura a seleção da foto.
- **O que está simulado:** o "envio" — o backend recebe uma string `pendente-upload://<nome-do-arquivo>` no campo `foto_comprovante_url`, não um arquivo real; nada é persistido em nenhum storage.
- **O que está faltando:** endpoint de upload (multipart ou upload direto assinado) para Supabase Storage (ou S3/equivalente); redimensionamento/compressão de imagem; validação de tipo/tamanho de arquivo; associação segura entre o arquivo armazenado e a infração.
- **Riscos:** sem foto real, a infração não tem prova documental válida — risco jurídico direto para a autuação ser contestada e derrubada pelo motorista.
- **Dependências:** bucket configurado no Supabase Storage (ou equivalente) e políticas de acesso (RLS) definidas.
- **Prioridade:** ALTA.

---

## 11. GPS/Geolocalização

**Status atual:** AUSENTE.

**Arquivos:** nenhum — `localizacao_rua` em `infracoes_zona_azul` é texto livre digitado pelo fiscal.

- **O que já funciona:** nada relacionado a GPS.
- **O que está simulado:** nada — simplesmente não existe.
- **O que está faltando:** captura de `latitude`/`longitude` via `navigator.geolocation` no momento da consulta de placa e da emissão de infração; colunas de coordenadas nas tabelas; validação de que o fiscal está fisicamente próximo da placa consultada (anti-fraude).
- **Riscos:** localização de infração 100% dependente de digitação manual é fonte de erro e de contestação jurídica; sem coordenadas, o mapa de "vias mais lucrativas" do dashboard (seção 6) fica limitado a texto de setor, não a um mapa real.
- **Dependências:** permissão de geolocalização no navegador/app; escolha de provedor de mapas (ver seção 12) se for exibir num mapa.
- **Prioridade:** MÉDIA (importante para robustez jurídica e para o dashboard visual, mas o sistema funciona sem isso no piloto).

---

## 12. Mapas

**Status atual:** AUSENTE.

**Arquivos:** nenhum.

- **O que já funciona:** nada — o dashboard do governo (seção 6) representa "setores" como barras de progresso, não como mapa geográfico.
- **O que está faltando:** biblioteca de mapas (Google Maps, Mapbox ou Leaflet/OpenStreetMap) para visualizar vagas, infrações e setores geograficamente; geocodificação de endereços para coordenadas.
- **Riscos:** nenhum risco técnico — é uma funcionalidade de valor agregado ainda não construída, não uma falha.
- **Dependências:** GPS/geolocalização (seção 11) precisa existir antes de um mapa fazer sentido; escolha de provedor de mapas tem custo (Google Maps cobra por uso acima de cota).
- **Prioridade:** BAIXA (é diferencial competitivo, não bloqueador do piloto).

---

## 13. Notificações

**Status atual:** PARCIAL — só o canal WhatsApp existe, e só para dois eventos.

**Arquivos:** `src/config/whatsappClient.ts`, `src/config/cronTasks.ts`, `src/modules/driver/ticketManager.ts`.

- **O que já funciona:** notificação de confirmação de Pix e alerta de vencimento em 9–10 minutos (ambas via WhatsApp, sujeitas à seção 9).
- **O que está simulado:** nada tecnicamente, mas dependem de templates não aprovados (seção 9).
- **O que está faltando:** notificação da própria infração para o motorista (quando uma multa é emitida, ele não é avisado); canal alternativo (SMS/e-mail/push) para quando WhatsApp falha ou o número é inválido; notificações para o gestor público (ex: "arrecadação do dia disponível", "pico de infrações num setor"); preferências de opt-in/opt-out do cidadão (LGPD).
- **Riscos:** dependência de um único canal (WhatsApp) sem fallback significa que uma falha da Meta ou reprovação de template deixa o sistema totalmente mudo para o cidadão.
- **Dependências:** aprovação de templates (seção 9); decisão de canal de fallback.
- **Prioridade:** MÉDIA.

---

## 14. Workers/Cron

**Status atual:** FUNCIONAL, com desenho correto para produção.

**Arquivos:** `src/worker.ts`, `src/config/cronTasks.ts`, `render.yaml` (serviço `parkdigital-cron-alertas`).

- **O que já funciona:** `node-cron` rodando a cada 1 minuto, isolado num processo/serviço próprio (decisão deliberada para não duplicar alertas se a API escalar horizontalmente); testado e validado localmente (log de inicialização e execução confirmados).
- **O que está simulado:** nada.
- **O que está faltando:** monitoramento de falha do próprio worker (se o processo cair, não há alerta para a equipe); métricas de execução (quantos alertas disparados por ciclo, tempo de execução); mecanismo de retry/dead-letter para tickets cujo alerta falhou (hoje, se falhar, só loga e segue — não tenta de novo no próximo minuto para o mesmo ticket especificamente, mas como a janela é de 9–10 min, na prática há uma segunda chance natural).
- **Riscos:** sem alerta de "worker caiu", uma falha de infraestrutura pode passar despercebida por horas.
- **Dependências:** nenhuma técnica; observabilidade (seção 16) resolveria isso.
- **Prioridade:** MÉDIA.

---

## 15. Segurança

**Status atual:** PARCIAL — bons fundamentos (JWT, bcrypt, RBAC), mas com um buraco crítico e ausências relevantes.

**Arquivos:** `src/config/authMiddleware.ts`, `src/modules/auth/authManager.ts`, `src/modules/driver/webhookPayment.ts`, `src/server.ts`.

- **O que já funciona:** senhas com bcrypt (nunca texto puro); JWT assinado; RBAC por rota; CORS restrito a uma origem configurável; timing-safe login (hash fictício); `.dockerignore`/`.gitignore` bem configurados para não vazar segredos.
- **O que está simulado/ausente:** **webhook de pagamento sem autenticação** (seção 7 — CRÍTICO, é o item mais grave desta auditoria); sem rate limiting em nenhuma rota (login e ativação de vaga são os mais sensíveis); sem `helmet` ou headers de segurança HTTP explícitos; sem validação/sanitização centralizada de entrada (cada rota faz a sua, manualmente); sem rotação de `JWT_SECRET`; sem HTTPS forçado no nível da aplicação (depende de o Render/proxy fazer isso); sem política de LGPD explícita (dados pessoais — CPF, telefone — armazenados sem menção a criptografia em repouso, consentimento ou retenção).
- **Riscos:** o webhook de pagamento é uma vulnerabilidade de fraude financeira direta; ausência de rate limiting expõe login a força bruta e a API a abuso/DoS de baixo esforço.
- **Dependências:** nenhuma externa para os itens de rate limiting/headers; LGPD é decisão jurídica da empresa.
- **Prioridade:** CRÍTICA (webhook) / ALTA (rate limiting, headers, LGPD).

---

## 16. Logs e auditoria

**Status atual:** PARCIAL — logging básico existe, auditoria formal não.

**Arquivos:** uso disperso de `console.log`/`console.error`/`console.warn` em praticamente todos os módulos.

- **O que já funciona:** eventos importantes são logados (login bem-sucedido/falho, acesso negado por role, infração emitida, falha de envio de WhatsApp, erros de banco).
- **O que está faltando:** logger estruturado (JSON, níveis, correlação de request) — hoje é texto livre no stdout, difícil de consultar em produção; nenhuma tabela de auditoria no banco (quem alterou o quê e quando — além do que já é inerente às colunas `data_ativacao`/`data_emissao`); nenhuma retenção/rotação de logs definida; nenhuma integração com ferramenta de observabilidade (Sentry, Datadog, etc.).
- **Riscos:** investigar um incidente em produção hoje depende de vasculhar logs de texto livre no painel do Render, sem correlação entre requisições.
- **Dependências:** nenhuma técnica bloqueante; é esforço de engenharia direto.
- **Prioridade:** MÉDIA.

---

## 17. Testes

**Status atual:** AUSENTE.

**Arquivos:** nenhum arquivo `*.test.ts`/`*.spec.ts` existe no projeto; nenhum framework de teste (Jest/Vitest) está instalado.

- **O que já funciona:** toda validação até aqui foi manual (curl, Playwright ad-hoc, builds reais) — funcionou para desenvolvimento, mas não é repetível automaticamente.
- **O que está faltando:** testes unitários (regras de negócio: cálculo de expiração, geração de Pix, validações de payload); testes de integração (rotas HTTP com Supabase real ou mockado); testes E2E do frontend; testes de contrato entre frontend e backend; pipeline de CI que rode tudo isso a cada PR (não existe `.github/workflows` no repositório).
- **Riscos:** qualquer mudança futura pode quebrar comportamento existente sem que ninguém perceba antes de produção; o PR aberto atualmente (#1) não tem nenhum check automatizado além dos que um humano rodar manualmente.
- **Dependências:** nenhuma técnica; decisão de stack de teste (Jest ou Vitest para o backend; Playwright/Testing Library para o frontend).
- **Prioridade:** ALTA (bloqueia crescimento seguro do time/código).

---

## 18. Docker/Deploy

**Status atual:** FUNCIONAL (backend), validado com daemon real; frontend sem containerização (não é necessário — vai para Vercel).

**Arquivos:** `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `render.yaml`.

- **O que já funciona:** build multi-estágio validado de verdade contra um daemon Docker (não só simulado) — encontrou e corrigiu um bug real (Node 20 → 22, exigido pelo `@supabase/supabase-js` atual, mais um bug intermitente de `npm ci` corrigido atualizando o `npm` na imagem); imagem final roda como usuário não-root; `render.yaml` provisiona corretamente os dois serviços (web + worker) com segredos compartilhados via `envVarGroup`; healthcheck configurado (`/health`).
- **O que está simulado/incompleto:** a validação do build **sob a política de rede restrita deste ambiente de teste** (proxy interceptando TLS) não pôde ser 100% concluída porque exigiria `--network host`, bloqueado pela política de sandbox desta sessão — isso é uma limitação do ambiente de auditoria, não do Dockerfile em si (o Render, ambiente real de destino, não tem essa camada de proxy).
- **O que está faltando:** pipeline de CI/CD automatizado (não há `.github/workflows` fazendo build/test/deploy a cada push — o deploy no Render acontece via `autoDeploy: true` direto do branch, sem gate de qualidade); sem ambiente de staging separado de produção; sem estratégia de rollback documentada; sem monitoramento de saúde além do healthcheck básico.
- **Riscos:** sem CI, um `git push` com bug quebrado vai direto para produção (o único freio é `autoDeploy` falhar no build, que já seria tarde).
- **Dependências:** nenhuma técnica bloqueante.
- **Prioridade:** ALTA (CI/CD e staging) para operar com segurança; a containerização em si já está madura.

---

## 19. Performance

**Status atual:** PARCIAL — adequado para escala de piloto (um município, baixo volume), não avaliado para escala de produção.

**Arquivos:** `src/modules/governo/dashboardFinanceiro.ts`, `src/config/cronTasks.ts`.

- **O que já funciona:** índices no banco nos campos certos (placa, status+data); queries do dashboard já filtram por dia (não escaneiam a tabela inteira histórica).
- **O que está faltando:** nenhuma paginação em nenhuma rota que lista dados (hoje nenhuma lista cresceu o suficiente para doer, mas `relatorio_por_setor` e futuras listagens de infrações crescerão sem limite); nenhum cache (o dashboard recalcula tudo a cada request); nenhum teste de carga; connection pooling do Supabase não configurado explicitamente (usa o padrão do cliente); sem CDN/cache para o frontend estático.
- **Riscos:** em um cenário de vários municípios simultâneos com volume real de transações, as duas queries do dashboard financeiro (linhas 21–40 de `dashboardFinanceiro.ts`) vão degradar sem paginação/agregação no banco.
- **Dependências:** decisão de mover agregações pesadas para funções SQL/materialized views se o volume crescer.
- **Prioridade:** BAIXA agora / ALTA antes de escalar para múltiplos municípios com volume real.

---

## 20. Multi-município

**Status atual:** AUSENTE — arquitetura atual é rigidamente single-tenant.

**Arquivos:** todo o schema (`sql/*`), toda a camada de queries (`src/modules/**`).

- **O que já funciona:** nada relacionado a múltiplos clientes — o sistema assume implicitamente "um município = um deploy inteiro" (um Supabase, um backend, um frontend).
- **O que está faltando:** coluna `municipio_id` (ou equivalente) em `tickets_zona_azul`, `infracoes_zona_azul` e `usuarios`; isolamento de dados entre municípios (Row Level Security no Supabase seria o caminho natural); configuração por município (preço por minuto, chave Pix, WhatsApp — hoje são variáveis de ambiente globais do processo, ou seja, **um único preço e uma única chave Pix para todo o sistema**); painel de administração da plataforma para cadastrar/gerenciar municípios (ver seção 21).
- **Riscos:** este é o maior desalinhamento entre o pitch comercial (`PROPOSTA_COMERCIAL.md`, vender para "prefeituras" no plural) e o estado real do código, que só serve uma prefeitura por deploy.
- **Dependências:** decisão arquitetural: banco compartilhado com RLS por `municipio_id` vs. banco isolado por cliente (trade-off de isolamento vs. custo operacional).
- **Prioridade:** CRÍTICA para o modelo de negócio SaaS descrito na proposta comercial; irrelevante se o plano for vender um deploy dedicado por prefeitura (aí o "multi-tenant" é só operacional, não de código).

---

## 21. Administração da plataforma

**Status atual:** AUSENTE.

**Arquivos:** nenhum.

- **O que já funciona:** nada — não existe um painel para a própria ParkDigital gerenciar clientes, cobrança, uso ou suporte.
- **O que está faltando:** CRUD de municípios/clientes; gestão de planos e faturamento (a proposta comercial oferece assinatura fixa OU % sobre Pix — nada disso é calculado, cobrado ou faturado automaticamente hoje); painel de suporte/observabilidade cross-cliente; gestão de usuários da própria equipe ParkDigital (hoje `usuarios` só modela papéis do lado do cliente: motorista/fiscal/gestor).
- **Riscos:** sem isso, cada onboarding de cliente novo depende 100% de trabalho manual de engenharia (rodar SQL, configurar variáveis de ambiente, etc.) — não escala além de poucos clientes.
- **Dependências:** decisão de multi-tenant (seção 20) deveria vir antes, para o painel de administração ser desenhado sobre a arquitetura certa desde o início.
- **Prioridade:** ALTA (necessário antes do segundo ou terceiro cliente, mesmo que o piloto com o primeiro não precise disso).

---

## 22. Relatórios

**Status atual:** PARCIAL — um único relatório existe (arrecadação do dia), mais nada.

**Arquivos:** `src/modules/governo/dashboardFinanceiro.ts`.

- **O que já funciona:** arrecadação do dia atual, contagem de tickets ativos, quebra por setor — tudo calculado ao vivo a partir do banco.
- **O que está faltando:** filtro por período (semana/mês/intervalo customizado); exportação (CSV/PDF/Excel) para prestação de contas oficial; relatório de infrações (quantas emitidas, por fiscal, por rua, status de notificação — lembrando que `infracoes_zona_azul.status` fica parado em `AGUARDANDO_EMISSAO_NOTIFICACAO` para sempre, pois nada nunca atualiza esse campo); relatório de motoristas/reincidência; comparativos históricos (mês a mês, ano a ano).
- **Riscos:** um secretário de fazenda não consegue, hoje, tirar um relatório fechado do mês para prestação de contas — só vê o "agora".
- **Dependências:** nenhuma técnica bloqueante; é desenvolvimento direto sobre o schema existente.
- **Prioridade:** MÉDIA (importante para o valor de venda "BI financeiro em tempo real" do pitch comercial, mas não bloqueia o piloto operacional).

---

## 23. Experiência do usuário

**Status atual:** PARCIAL — telas do motorista e fiscal são bem cuidadas para o caminho feliz; lacunas em estados de erro, acessibilidade e alcance.

**Arquivos:** `parkdigital-frontend/src/app/**`.

- **O que já funciona:** design mobile-first consistente (azul escuro/cinza, identidade de autoridade pública); estados de carregamento (`Loader2` animado) e erro (banners vermelhos) tratados nas telas de motorista e fiscal; máscaras de placa/CPF; feedback visual claro (verde/vermelho) para regularidade.
- **O que está faltando:** nenhum teste de acessibilidade (contraste, leitores de tela, navegação por teclado) foi feito; nenhuma versão PWA (instalável, funciona offline) — discutido anteriormente como próximo passo natural; sem app nativo (iOS/Android) — hoje é só web; sem internacionalização (só português); sem onboarding/tutorial para o primeiro uso; painel do governo não tem estado de erro real (a simulação nunca falha, então esse caminho nunca foi visualmente testado); fiscal não tem modo offline (crítico para uso em campo com sinal instável).
- **Riscos:** falta de modo offline é o risco mais concreto — um fiscal em área de sombra de sinal simplesmente não consegue emitir a infração naquele momento, com a placa já fora de vista.
- **Dependências:** PWA/offline depende de service worker + fila local de requisições pendentes.
- **Prioridade:** MÉDIA (o essencial já está bom; offline é o item de maior impacto real de campo).

---

## Resumo de prioridades

| Prioridade | Itens |
|---|---|
| **CRÍTICA** | Webhook de pagamento sem autenticação (7/15); Gateway Pix real (4/7/8); Tela de login no frontend (3); Multi-município (2/20) — se o modelo SaaS for mantido |
| **ALTA** | Rate limiting e headers de segurança (15); Testes automatizados (17); CI/CD e staging (18); Upload real de fotos (10); Dashboard do governo conectado ao backend real (6); App do fiscal em produção (5) — depende de 3 e 10; WhatsApp — aprovação de templates (9); Administração da plataforma (21) |
| **MÉDIA** | Backend — validação com schema e logger estruturado (1); Workers/cron — observabilidade (14); Notificações — canal de fallback (13); Logs e auditoria (16); Relatórios — filtros e exportação (22); UX — modo offline do fiscal (23); GPS/geolocalização (11) |
| **BAIXA** | Mapas (12); Performance — otimizações antecipadas (19) |

---

## Roadmap Técnico Sugerido

A ordem abaixo prioriza **destravar um piloto real com um único município pagante** antes de investir em multi-tenant/administração de plataforma (que só importa quando houver um segundo cliente).

### Fase 0 — Fechar o buraco de segurança (imediato, antes de qualquer coisa)
1. Autenticar o webhook de pagamento (assinatura HMAC ou, no mínimo, um segredo compartilhado validado) — **isso deveria ser feito mesmo antes de qualquer outra tarefa desta lista**, pois é uma vulnerabilidade ativa.
2. Adicionar rate limiting básico em `/auth/login` e `/motorista/vaga/ativar`.

### Fase 1 — Tornar o produto usável de ponta a ponta (piloto com 1 município)
3. Construir a tela de login no frontend (motorista opcional, fiscal e gestor obrigatório) e conectar o `localStorage` de token de verdade.
4. Conectar o dashboard do governo ao endpoint real (remover o mock), aceitando que "ocupação" e "infrações do dia" fiquem de fora até existirem endpoints próprios.
5. Implementar upload real de foto (Supabase Storage) e trocar `pendente-upload://` pela URL real.
6. Integrar um gateway Pix real (Asaas/Mercado Pago) substituindo a geração simulada — inclui geração de QR Code real.

### Fase 2 — Confiabilidade e processo de engenharia
7. Introduzir suíte de testes (unitários no backend primeiro, depois integração) e um pipeline de CI que rode `tsc`, lint e testes a cada PR.
8. Logger estruturado + validação de schema (ex: Zod) nas rotas mais críticas (ativação de vaga, webhook, login).
9. Submeter e aprovar os templates do WhatsApp na Meta Business Manager.

### Fase 3 — Robustez operacional
10. GPS/geolocalização na consulta de placa e emissão de infração.
11. Endpoints de relatório com filtro de período e exportação (CSV no mínimo).
12. Fluxo de atualização de status da infração (`AGUARDANDO_EMISSAO_NOTIFICACAO` → algo que efetivamente avance).
13. Modo offline básico no app do fiscal (fila local + sincronização).

### Fase 4 — Escala multi-cliente (só depois do primeiro cliente pagante validado)
14. Decisão e implementação de multi-tenant (RLS por `municipio_id` ou banco isolado por cliente).
15. Painel de administração da plataforma (cadastro de município, configuração de preço/chave Pix por cliente, faturamento).
16. Mapas e visualização geográfica no dashboard do governo.

---

*Este documento reflete o estado do código em `claude/loving-pasteur-yzggyw` no momento da auditoria. Nenhuma alteração de código foi feita — conforme solicitado, esta é apenas a fase de diagnóstico.*
