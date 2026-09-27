# ==========================================
# Estágio 1: Build (compilação TypeScript e Dev)
# ==========================================
FROM node:22-bookworm-slim AS build

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Instala o Chromium e dependências de sistema
RUN npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN npm run build

# ==========================================
# Estágio 2: Runtime (imagem final de produção)
# ==========================================
FROM node:22-bookworm-slim AS runtime

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copia o Chromium do estágio de build sem precisar baixar novamente
COPY --from=build /ms-playwright /ms-playwright

# Instala as dependências de sistema do Chromium no runtime
RUN npx playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# Copia os artefatos compilados do estágio de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

EXPOSE 3001

CMD ["npm", "start"]
