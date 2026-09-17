# syntax=docker/dockerfile:1

# ---------- Estágio 1: builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ---------- Estágio 2: runner ----------
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN addgroup -S parkdigital && adduser -S parkdigital -G parkdigital
USER parkdigital

EXPOSE 3000

CMD ["node", "dist/server.js"]
