# syntax=docker/dockerfile:1

# ---------- Estágio 1: builder ----------
# Node 22+ é exigido pelas dependências atuais do @supabase/supabase-js
# (auth-js/postgrest-js/realtime-js/storage-js); em Node 20 o npm ci falha
# silenciosamente ao resolver essas dependências.
FROM node:22-alpine AS builder

WORKDIR /app

# A versão de npm empacotada na imagem base tem um bug intermitente
# ("Exit handler never called!") que corrompe silenciosamente o npm ci;
# atualizar o npm antes de instalar evita o problema.
RUN npm install -g npm@latest

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------- Estágio 2: runner ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

RUN npm install -g npm@latest

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S parkdigital && adduser -S parkdigital -G parkdigital
USER parkdigital

EXPOSE 3000

CMD ["node", "dist/server.js"]
