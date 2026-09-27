# ==========================================
# Estágio 1: Build (compilação TypeScript)
# ==========================================
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ==========================================
# Estágio 2: Runtime (imagem final de produção)
# ==========================================
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Instala o navegador Chromium e suas dependências de sistema
RUN npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache

# Copia os artefatos compilados do estágio de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

EXPOSE 3001

CMD ["npm", "start"]
