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

## Fase 1 — Modelo de dados

Definir o schema em Drizzle (`schema.ts`) e gerar as migrations via `drizzle-kit generate`, aplicando com `drizzle-kit migrate`. Colunas geométricas (`geom`) e índices `GIST` normalmente exigem SQL raw dentro da migration gerada (Drizzle não modela `GEOMETRY`/`GIST` nativamente) — isso é esperado, não é um problema a resolver.

1. Tabela `imoveis` (com `geom GEOMETRY(Point,4326)` **e** índice `GIST(geom)` — não esquecer, é o item que faltou no plano original).
2. Tabela `pontos_interesse` (com `GIST(geom)`).
3. Tabela `pesos_configuracao`, já populando uma linha `perfil='padrao'` com pesos default (seed).
4. Tabela extra: `imoveis_historico_preco` (id, imovel_id, preco, capturado_em) — para série temporal.
5. Constraint de deduplicação: `UNIQUE(url_origem)` em `imoveis` quando `url_origem` não for nulo.

**Critério de saída:** consegue inserir manualmente 1 imóvel de teste e 1 POI de teste via SQL e consultar distância entre eles com `ST_Distance(geom::geography)`.

---

## Fase 2 — Carga fria de POIs (OSM)

1. Script standalone (não faz parte do fluxo web) que consulta Overpass API para farmácias, padarias, supermercados dentro dos limites de Porto Alegre.
2. Inserir na tabela `pontos_interesse` com `origem='osm'`.
3. Cadastrar manualmente os marcos fixos pessoais (Redenção, Parcão, Saída de POA, residência) com `origem='manual'`.
4. Script deve ser idempotente (rodar de novo não duplica — usar upsert por nome+geom ou hash).

**Critério de saída:** `SELECT count(*) FROM pontos_interesse GROUP BY categoria` mostra números plausíveis para POA.

---

## Fase 3 — Pipeline de ingestão de anúncio (backend, sem frontend ainda)

Construir como endpoint único primeiro (`POST /imoveis/importar {url}`), testável via curl/Postman.

1. **Scraper:** Playwright stealth, timeout curto, tratamento explícito de falha (CAPTCHA, 403, timeout) que não derruba o processo — retorna erro estruturado.
2. Readability/Turndown → Markdown limpo.
3. **Extração via Ollama:** chamada com JSON Schema estrito. Incluir no schema um campo `confianca_extracao` (o próprio modelo se autoavalia baixo/médio/alto) ou, no mínimo, logar o markdown bruto junto ao resultado para auditoria manual.
4. Validação pós-LLM: `preco` e `area_util` precisam ser numéricos e > 0, senão a inserção fica pendente de revisão manual em vez de entrar direto no banco.
5. **Geocodificação:** tentar Nominatim primeiro; se falhar ou retornar baixa precisão, cair para Google Maps Geocoding.
6. Checar deduplicação por `url_origem` antes de inserir. Se já existe, inserir novo registro em `imoveis_historico_preco` em vez de duplicar o imóvel.
7. Persistir imóvel com `geom` populado.

**Critério de saída:** dado uma URL real de anúncio, o endpoint retorna o imóvel estruturado e salvo no banco, com endereço geocodificado corretamente. Testar com 3–5 URLs reais variadas (inclusive uma que deve falhar) para validar o tratamento de erro.

**Dockerização:** criar `Dockerfile` do backend e adicionar o serviço `backend` ao `docker-compose.yml` (dependente do serviço `db`, via `depends_on`). A partir desta fase, `docker compose up -d` deve subir banco + backend juntos. Se o Ollama também rodar localmente, documentar no `.env`/README como o container do backend acessa o host (ex.: `OLLAMA_HOST=http://host.docker.internal:11434` no Windows/Mac).

---

## Fase 4 — Motor de scoring

1. Implementar cálculo de distâncias do imóvel aos POIs fixos via `ST_Distance`.
2. Implementar contagem de comércio próximo via `ST_DWithin` (raio configurável).
3. Implementar normalização — **usar winsorização/percentil antes do min-max**, não min-max puro (ponto do review anterior).
4. Implementar cálculo consolidado ponderado, lendo pesos de `pesos_configuracao`.
5. Expor endpoint `GET /imoveis/:id/score` e `GET /imoveis` (lista já com score calculado).

**Critério de saída:** com pelo menos 5–10 imóveis reais importados na Fase 3, o score gerado faz sentido intuitivo (imóvel mais caro por m² e mais longe dos POIs relevantes deve pontuar pior).

---

## Fase 5 — Frontend básico (lista + mapa, sem interatividade avançada)

1. Setup React + Tailwind + shadcn/ui.
2. Tela única: grid lateral de cards (lendo `GET /imoveis`) + MapLibre com marcadores simples (sem estilo pílula ainda).
3. Estilo de mapa vetorial neutro.

**Critério de saída:** abre a página, vê os imóveis importados nas Fases 3–4 como pontos no mapa e cards na lista, com preço e score visíveis.

**Dockerização:** criar `Dockerfile` do frontend (build estático servido via nginx, ou dev server dockerizado, à escolha do agente) e adicionar o serviço `frontend` ao `docker-compose.yml`. A partir desta fase, o projeto inteiro sobe com um único `docker compose up -d` — este é o estado que torna o handoff para outra pessoa trivial (`git clone` + `docker compose up -d`).

---

## Fase 6 — Polimento de interface

1. Marcadores estilo pílula (Airbnb-like) com preço/nota.
2. Hover no card ↔ destaque no marcador (e vice-versa).
3. Drawer/modal ao clicar: galeria de imagens, comentário da IA, breakdown de distâncias.
4. Painel de sliders de pesos, recalculando score **no cliente** (buscar todos os imóveis com métricas brutas, não só o score final, para permitir recálculo sem nova chamada ao backend).

**Critério de saída:** fluxo de uso completo funciona visualmente como descrito no plano original.

---

## Fase 7 — Robustez e itens adiados do review

Só entrar aqui depois que o fluxo ponta a ponta (Fases 0–6) estiver funcionando de verdade com dados reais.

1. Download/armazenamento local das imagens dos anúncios (evitar hotlink quebrado).
2. Rate limiting no scraper + fila (mesmo que simples, tipo `p-queue`) para evitar rajadas de requisições.
3. Tela/endpoint de revisão manual para imóveis com `confianca_extracao` baixa ou validação numérica reprovada.
4. (Opcional, avaliar custo/benefício) Integração OSRM local para distância real de caminhada em vez de linha reta.
5. Visualização do histórico de preço por imóvel (usar a tabela `imoveis_historico_preco` já criada na Fase 1).

---

## Ordem de dependência resumida

```
Fase 0 → Fase 1 → Fase 2 ─┐
                            ├─→ Fase 3 → Fase 4 → Fase 5 → Fase 6 → Fase 7
Fase 1 ─────────────────────┘
```

Fase 2 (POIs) pode rodar em paralelo à Fase 1 depois que as migrations existirem, mas Fase 3 depende de ambas (precisa de POIs no banco para o scoring fazer sentido, e precisa do schema pronto).

## Regra de ouro para o agente

Ao final de cada fase, parar e reportar: o que foi feito, o que foi testado, e qualquer decisão tomada que não estava 100% especificada no plano original (ex.: qual biblioteca de fila usou, qual threshold de confiança considerou "baixo"). Não seguir para a próxima fase silenciosamente.