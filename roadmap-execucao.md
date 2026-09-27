# Roadmap de Execução — Plataforma de Análise e Scoring de Imóveis

Regra geral para o agente: **cada fase deve terminar em algo testável e commitável antes de avançar para a próxima.** Não pular fases. Não implementar frontend antes do backend responder dados reais. Não otimizar (OSRM, percentil, etc.) antes de o fluxo básico funcionar ponta a ponta.

---

## Fase 0 — Fundação do projeto

**Pré-requisito de ambiente:** projeto será totalmente dockerizado (banco, backend e frontend), pensando em portabilidade/handoff futuro para outra pessoa. Um único `docker-compose.yml` na raiz vai centralizar todos os serviços, adicionando um serviço por fase conforme ele passa a existir. Não instalar Postgres nativo — usar container mesmo em dev.

1. Verificar/instalar Docker Desktop (validar com `docker --version` e `docker ps` sem erro).
2. Inicializar repositório (backend + frontend em monorepo ou duas pastas).
3. Criar `docker-compose.yml` na raiz com o serviço `db` usando a imagem `postgis/postgis:16-3.4` (Postgres 16 + PostGIS já embutidos), com volume nomeado para persistência.
4. Se houver um PostgreSQL nativo rodando na máquina, parar o serviço nativo (ou mapear o container para outra porta) para evitar conflito de porta 5432.
5. Criar `.env.example` com todas as variáveis previstas desde já: `DATABASE_URL` (apontando para o container), `OLLAMA_MODEL`, `OLLAMA_HOST`, `GOOGLE_MAPS_API_KEY`, `GEOCODER_PRIMARY` (nominatim|google).
6. **Instalar o Drizzle ORM no backend** (`npm install drizzle-orm pg` + `npm install -D drizzle-kit`), com arquivo de config apontando pro `DATABASE_URL` do container. Drizzle é a escolha definitiva do projeto — não usar Prisma/TypeORM/Sequelize. Motivo: o projeto depende fortemente de queries espaciais nativas do PostGIS (`ST_Distance`, `ST_DWithin`), e Drizzle permite misturar query builder tipado com SQL raw (`sql\`...\`\`) sem fricção, ao contrário de ORMs que escondem o SQL.

**Critério de saída:** `docker compose up -d` sobe o banco com PostGIS disponível (`SELECT postgis_version();` funciona). Drizzle está configurado e conectando ao container.

---

## Fase 1 — Modelo de dados (Suporte a Venda e Aluguel)

Definir o schema em Drizzle (`schema.ts`) e gerar as migrations via `drizzle-kit generate`, aplicando com `drizzle-kit migrate`. Colunas geométricas (`geom`) e índices `GIST` normalmente exigem SQL raw dentro da migration gerada (Drizzle não modela `GEOMETRY`/`GIST` nativamente) — isso é esperado, não é um problema a resolver.

1. Tabela `imoveis` com suporte a **Venda e Aluguel**:
   * `tipo_transacao` (VARCHAR: 'venda' | 'aluguel', NOT NULL).
   * `preco` (NUMERIC: valor de venda OU aluguel mensal).
   * `condominio` (NUMERIC: taxa mensal de condomínio, default 0).
   * `iptu` (NUMERIC: valor mensal de IPTU, default 0).
   * `custo_total_mensal` (NUMERIC: aluguel + condomínio + IPTU para aluguéis).
   * `area_util` e `preco_m2`.
   * `geom GEOMETRY(Point,4326)` **e** índice `GIST(geom)`.
   * `confianca_extracao` ('baixa', 'media', 'alta').
2. Tabela `pontos_interesse` (com `hash_id VARCHAR UNIQUE` e `GIST(geom)`).
3. Tabela `pesos_configuracao`, populando perfis default para **Venda** (`venda_padrao`) e **Aluguel** (`aluguel_padrao`), permitindo ponderar custo total mensal em locações.
4. Tabela extra: `imoveis_historico_preco` (id, imovel_id, tipo_transacao, preco, condominio, iptu, capturado_em) — para série temporal detalhada.
5. Constraint de deduplicação: `UNIQUE(url_origem)` em `imoveis` quando `url_origem` não for nulo.

**Critério de saída:** consegue inserir manualmente 1 imóvel de venda, 1 de aluguel e 1 POI de teste via SQL e consultar distância entre eles com `ST_Distance(geom::geography)`.

---

## Fase 2 — Carga fria de POIs (OSM)

1. Script standalone (não faz parte do fluxo web) que consulta Overpass API para farmácias, padarias, supermercados dentro dos limites de Porto Alegre.
2. Inserir na tabela `pontos_interesse` com `origem='osm'`.
3. Cadastrar manualmente os marcos fixos pessoais (Redenção, Parcão, Saída de POA, residência) com `origem='manual'`.
4. Script deve ser idempotente (rodar de novo não duplica — usar upsert por nome+geom ou hash).
5. Comandos CLI para extensão futura do catálogo de POIs (parques, praças, escolas, hospitais, academias) sob demanda (`npm run pois:import`).

**Critério de saída:** `SELECT count(*) FROM pontos_interesse GROUP BY categoria` mostra números plausíveis para POA.

---

## Fase 3 — Pipeline de ingestão de anúncio (backend, sem frontend ainda)

Construir como endpoint único primeiro (`POST /imoveis/importar {url}`), testável via curl/Postman.

1. **Scraper:** Playwright stealth, timeout curto, tratamento explícito de falha (CAPTCHA, 403, timeout) que não derruba o processo — retorna erro estruturado.
2. Readability/Turndown → Markdown limpo.
3. **Extração via Ollama:** chamada com JSON Schema estrito incluindo:
   * `tipo_transacao`: 'venda' | 'aluguel'
   * `preco`: valor de venda ou aluguel mensal
   * `condominio`: valor de condomínio mensal
   * `iptu`: valor mensal de IPTU
   * `area_util`, `endereco`, `bairro`, `posicao_solar`, `comentario_analise`, `confianca_extracao`.
4. Validação pós-LLM: `preco` e `area_util` precisam ser numéricos e > 0; cálculo de `custo_total_mensal = preco + condominio + iptu` caso seja aluguel.
5. **Geocodificação:** tentar Nominatim primeiro; se falhar ou retornar baixa precisão, cair para Google Maps Geocoding e depois centroides de bairros de POA.
6. Checar deduplicação por `url_origem` antes de inserir. Se já existe, inserir novo registro em `imoveis_historico_preco` em vez de duplicar o imóvel.
7. Persistir imóvel com `geom` populado.

**Critério de saída:** dado uma URL real de anúncio, o endpoint retorna o imóvel estruturado e salvo no banco, com endereço geocodificado corretamente. Testar com URLs de venda e aluguel.

**Dockerização:** criar `Dockerfile` do backend e adicionar o serviço `backend` ao `docker-compose.yml` (dependente do serviço `db`, via `depends_on`). A partir desta fase, `docker compose up -d` deve subir banco + backend juntos. Se o Ollama também rodar localmente, documentar no `.env`/README como o container do backend acessa o host (ex.: `OLLAMA_HOST=http://host.docker.internal:11434` no Windows/Mac).

---

## Fase 4 — Motor de scoring (Particionado por Tipo de Transação)

1. Implementar cálculo de distâncias do imóvel aos POIs fixos via `ST_Distance`.
2. Implementar contagem de comércio próximo via `ST_DWithin` (raio configurável).
3. **Normalização Particionada:**
   * Normalização (winsorização/percentil antes do min-max) executada **estritamente separada** para Venda (baseada em `preco_m2`) e Aluguel (baseada em `custo_total_mensal` e aluguel/m²), impedindo distorção de notas entre grandezas incomparáveis.
4. Implementar cálculo consolidado ponderado, lendo pesos respectivos de `pesos_configuracao` (`venda_padrao` ou `aluguel_padrao`).
5. Expor endpoints:
   * `GET /imoveis/:id/score`
   * `GET /imoveis?tipo=venda` e `GET /imoveis?tipo=aluguel` (lista já com score calculado particionado).

**Critério de saída:** com imóveis reais de venda e aluguel importados, os scores fazem sentido intuitivo sem contaminação mútua entre categorias.

---

## Fase 5 — Frontend básico (lista + mapa, com seletor Venda/Aluguel)

1. Setup React + Tailwind + Radix UI padrão com suporte a light e dark mode (preferencialmente light).
2. **Controle Primário de Transação:** Toggle/abas no topo: **"Comprar" (Venda)** vs **"Alugar" (Aluguel)**.
3. Grid lateral de cards customizados por tipo:
   * Venda: exibe Preço Total e R$/m².
   * Aluguel: exibe Aluguel Mensal, Condomínio, IPTU e Custo Total Mensal.
4. MapLibre GL JS com marcadores e estilo vetorial neutro.

**Critério de saída:** abre a página, alterna entre Aluguel e Venda, e visualiza cards e pontos correspondentes no mapa com scores segmentados.

**Dockerização:** criar `Dockerfile` do frontend e adicionar o serviço `frontend` ao `docker-compose.yml`.

---

## Fase 6 — Polimento de interface

1. Marcadores customizados no mapa (destacando nota calculada ou valor financeiro adaptado ao tipo de transação).
2. Hover no card ↔ destaque no marcador (e vice-versa).
3. Drawer/modal ao clicar: galeria de imagens, comentário da IA, breakdown de distâncias e detalhamento de custos.
4. Painel de sliders de pesos adaptados ao perfil ativo (venda vs aluguel), recalculando score **no cliente** em tempo real.

**Critério de saída:** fluxo de uso completo funciona visualmente com excelente UX e suporte a ambos os modelos de negócio.

---

## Fase 7 — Robustez e itens adiados do review

Só entrar aqui depois que o fluxo ponta a ponta (Fases 0–6) estiver funcionando de verdade com dados reais.

1. Download/armazenamento local das imagens dos anúncios (evitar hotlink quebrado).
2. Rate limiting no scraper + fila (mesmo que simples, tipo `p-queue`) para evitar rajadas de requisições.
3. Tela/endpoint de revisão manual para imóveis com `confianca_extracao` baixa ou validação numérica reprovada.
4. (Opcional) Integração OSRM local para distância real de caminhada em vez de linha reta.
5. Visualização do histórico de preço por imóvel (usar a tabela `imoveis_historico_preco`).

---

## Regra de ouro para o agente

Ao final de cada fase, parar e reportar: o que foi feito, o que foi testado, e qualquer decisão tomada que não estava 100% especificada no plano original. Não seguir para a próxima fase silenciosamente.