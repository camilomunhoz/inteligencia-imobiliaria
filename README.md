# Inteligência Imobiliária — Porto Alegre (RS)

Plataforma de inteligência de mercado, análise espacial e scoring multicritério de imóveis residenciais (Venda e Aluguel) em Porto Alegre, integrando PostgreSQL/PostGIS, IA local via Ollama (modelo de livre escolha do usuário, com indicação de `qwen2.5:7b`), roteamento viário OSRM e visualização interativa com MapLibre GL.

---

## 1. Stack Tecnológica

### Backend & Dados
* **Runtime:** Node.js 20+ com TypeScript (módulos ES).
* **Framework Web:** Fastify 5 (alta performance, streaming SSE nativo e suporte a CORS).
* **Banco de Dados:** PostgreSQL 16 com extensão espacial PostGIS 3.4.
* **ORM & Migrations:** Drizzle ORM (`drizzle-kit`, `pg`).
* **Roteamento Urbano:** OSRM (Open Source Routing Machine) com perfis a pé e carro, apoiado por fallback geodésico resiliente via Haversine / `ST_Distance`.

### IA & Ingestão
* **IA Local (Modelo Configurável pelo Usuário):** Integração com Ollama onde o usuário escolhe livremente qual LLM utilizar via variável `OLLAMA_MODEL`. O sistema utiliza schema JSON estrito para extração de tipologia, valores, condomínio, IPTU, orientação solar e grau de confiança. Sugerimos como referência o `qwen2.5:7b` pelo equilíbrio entre consumo de VRAM e precisão em JSON, mas modelos como `llama3.1:8b`, `mistral`, `deepseek-r1:8b` ou `qwen2.5:14b` são plenamente suportados.
* **Scraping:** Playwright em modo stealth com fila de rate-limiting e controle de concorrência.
* **Higienização DOM:** Mozilla Readability + JSDOM + Turndown para extração de Markdown limpo e URLs de fotos.
* **Geocodificação:** OpenStreetMap Nominatim com fallback para centroides de bairros de Porto Alegre.

### Frontend
* **SPA:** React 18 com TypeScript e Vite.
* **Estilização:** Tailwind CSS e Radix UI primitives.
* **Cartografia WebGL:** MapLibre GL JS com renderização vetorial de camadas GeoJSON (60fps) e marcadores interativos.
* **Temas:** Suporte nativo a Light Mode (padrão) e Dark Mode, com basemaps sincronizados (Carto Positron / Dark Matter).

---

## 2. Principais Funcionalidades

* **Modelagem Particionada (Venda vs Aluguel):**
  * **Venda:** normalização e scoring ponderados com base no valor de venda e preço por metro quadrado (`R$/m²`).
  * **Aluguel:** normalização e scoring baseados no **Custo Total Mensal** (aluguel base + condomínio + IPTU), evitando contaminação mútua entre ordens de grandeza distintas.
* **Motor de Scoring Espacial e Financeiro:**
  * Métricas calculadas via PostGIS: proximidade ao Parque Farroupilha (Redenção), Parque Moinhos de Vento (Parcão), saídas para a Freeway e densidade de comércio a pé em raio de 1 km (farmácias, supermercados e padarias).
  * Proteção estatística contra outliers via **winsorização** (percentis 5% e 95%) antes da normalização Min-Max.
* **Ajuste Dinâmico de Pesos e Recálculo no Cliente:**
  * Painel de sliders Radix com recálculo instantâneo no navegador (zero latência).
  * 5 perfis pré-configurados: *Equilibrado*, *Foco em Economia*, *Foco em Lazer/Parques*, *Foco em Conveniência* e *Foco em Mobilidade*.
* **Ingestão em Tempo Real com Server-Sent Events (SSE):**
  * Stepper com feedback detalhado de cada fase da importação: checagem de deduplicação, coleta stealth, higienização, extração via IA, geocodificação e persistência PostGIS.
  * Painel de logs cronológicos detalhados com carimbo de data e hora.
* **Camadas GeoJSON de POIs & Traçado de Rotas sob Demanda (Fase 8):**
  * Renderização de mais de 330 POIs de Porto Alegre via camadas vetoriais de círculos no MapLibre, sem sobrecarga no DOM.
  * Painel flutuante para ligar/desligar categorias (parques, praças, farmácias, mercados, padarias, pontos notáveis).
  * Traçado de rota real pelas ruas via OSRM ao conectar um imóvel a qualquer ponto do mapa, com alternador A pé / Carro, distância e tempo estimado.
* **Histórico Temporal de Preços & Revisão Manual:**
  * Sindicância temporal de cotações por imóvel na tabela `imoveis_historico_preco`.
  * Interface e endpoints para revisão e ajuste manual de dados extraídos com baixa confiança.
  * Armazenamento local de imagens em `/uploads/imoveis/:id/` para evitar hotlinks quebrados.

---

## 3. Estrutura do Projeto

```
inteligencia-imobiliaria/
├── backend/
│   ├── drizzle/                     # Migrations SQL versionadas
│   ├── src/
│   │   ├── db/                      # Schema Drizzle, conexão e tipos PostGIS
│   │   ├── services/
│   │   │   ├── cleaner.ts           # Readability + Turndown (HTML -> MD)
│   │   │   ├── geocoder.ts          # Nominatim / centroid POA
│   │   │   ├── image-storage.ts     # Download e cache local de fotos
│   │   │   ├── imoveis.ts           # Orquestrador de ingestão e deduplicação
│   │   │   ├── llm.ts               # Interface Ollama (modelo configurável) com schema estrito
│   │   │   ├── osrm.ts              # Roteamento viário OSRM com fallback geodésico
│   │   │   ├── queue.ts             # Fila de tarefas com rate-limiting
│   │   │   ├── scraper.ts           # Playwright stealth
│   │   │   └── scoring.ts           # PostGIS espacial + normalização particionada
│   │   ├── scripts/                 # Seeds de POIs, amostras e testes de saída
│   │   ├── server.ts                # Servidor Fastify e rotas da API
│   │   └── index.ts                 # Ponto de entrada do backend
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImportModal.tsx      # Modal de ingestão com streaming SSE
│   │   │   ├── Map.tsx              # MapLibre GL com camadas GeoJSON e rotas
│   │   │   ├── Navbar.tsx           # Alternador Venda/Aluguel e tema
│   │   │   ├── PropertyCard.tsx     # Cards de imóveis particionados
│   │   │   ├── PropertyDetailModal.tsx # Detalhes, sub-scores, histórico e edição
│   │   │   └── WeightSliders.tsx    # Sliders Radix e perfis pré-configurados
│   │   ├── types/                   # Tipagens TypeScript compartilhadas
│   │   ├── App.tsx                  # Split-screen, recálculo no cliente e filtros
│   │   └── main.tsx
│   ├── nginx.conf                   # Configuração Nginx de produção
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml               # Orquestração (db, backend, frontend, osrm)
└── roadmap-execucao.md              # Documentação das fases e critérios de saída
```

---

## 4. Pré-requisitos

1. **Node.js:** versão 20.x ou superior.
2. **PostgreSQL 16 + PostGIS 3.4:** executando via Docker ou nativamente.
3. **Ollama:** instalado e executando localmente (`http://localhost:11434`). O modelo de IA é de livre escolha do usuário, definido pela variável `OLLAMA_MODEL` no arquivo `.env` (o padrão indicado é o `qwen2.5:7b` pelo equilíbrio entre fidelidade ao schema JSON e baixo consumo de VRAM):
   ```bash
   # Indicação sugerida:
   ollama pull qwen2.5:7b

   # Ou qualquer outro modelo de sua preferência com suporte a JSON:
   # ollama pull llama3.1:8b
   # ollama pull mistral
   # ollama pull qwen2.5:14b
   ```

---

## 5. Como Executar

### 5.1 Execução com Docker Compose (Completa)

Para preparar os dados viários do OSRM para Porto Alegre (caso ainda não tenha gerado os índices):

```bash
npm run osrm:setup
```

Para subir todos os serviços orquestrados (Banco PostGIS, Backend Fastify, Frontend Nginx e Roteador OSRM):

```bash
docker compose up -d
```

* **Frontend:** `http://localhost:3000`
* **Backend API:** `http://localhost:3001`
* **PostgreSQL:** porta `5433` (mapeada para `5432` no container)
* **OSRM:** porta `5000` (roteamento viário real com fallback geodésico resiliente)

> **Nota para desenvolvimento:** Para rodar com hot-reload (tsx watch) e código montado como volume no backend, utilize `docker-compose.override.yml.example` renomeando-o para `docker-compose.override.yml`.

---

### 5.2 Execução em Modo de Desenvolvimento Local

#### 1. Configurar o Backend
No diretório `backend/`, copie o arquivo de exemplo de ambiente e instale as dependências:

```bash
cd backend
cp .env.example .env
npm install
```

Execute as migrations do banco de dados e os seeds de dados iniciais:
```bash
npm run db:migrate
npm run seed:pois
npm run seed:imoveis
```

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```
O backend estará disponível em `http://localhost:3001`.

#### 2. Configurar o Frontend
Em outro terminal, acesse a pasta `frontend/` e inicie o Vite:

```bash
cd frontend
npm install
npm run dev
```
O frontend estará acessível em `http://localhost:5173`.

---

## 6. Comandos e Testes de Validação

O projeto conta com baterias automatizadas de testes de saída que validam cada fase do roadmap:

```bash
# Na pasta backend/
npm run test:db        # Testa conectividade com PostgreSQL e PostGIS
npm run test:fase1     # Valida schema Drizzle e queries geográficas
npm run test:fase3     # Valida scraping Playwright, Turndown e IA Qwen 2.5
npm run test:fase4     # Valida motor de scoring particionado (Venda vs Aluguel)
npm run test:fase5     # Valida contratos da API e bundle do frontend
npm run test:fase6     # Valida streaming SSE e recálculo client-side
npm run test:fase7     # Valida fila com rate-limiting, cache de imagens e revisão
npm run test:fase8     # Valida OSRM, fallback geodésico, rotas e camadas GeoJSON
```

### Expansão do Dataset de POIs via CLI

Para enriquecer a base de pontos de interesse de Porto Alegre sob demanda (via Overpass API):

```bash
# Verificar status da base de POIs
npm run pois:status

# Importar novos POIs por categoria predefinida
npm run pois:import -- --preset=parques
npm run pois:import -- --preset=supermercados
npm run pois:import -- --preset=farmacias
npm run pois:import -- --preset=padarias
npm run pois:import -- --preset=escolas
npm run pois:import -- --preset=hospitais
```

---

## 7. Referência dos Endpoints da API

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` | Status de integridade da API e conexão com o banco |
| `GET` | `/imoveis` | Lista imóveis com scoring calculado (`?tipo=venda` ou `?tipo=aluguel`) |
| `GET` | `/imoveis/:id` | Detalhes do imóvel e histórico temporal de preços |
| `GET` | `/imoveis/:id/score` | Decomposição detalhada dos sub-scores e pesos do imóvel |
| `POST` | `/imoveis/importar` | Ingestão síncrona de anúncio a partir de URL |
| `POST` | `/imoveis/importar-stream` | Ingestão com streaming Server-Sent Events em tempo real |
| `GET` | `/imoveis/revisao` | Lista anúncios pendentes de revisão manual |
| `PUT` | `/imoveis/:id/revisao` | Atualização manual de dados do imóvel e gravação no histórico |
| `GET` | `/pois` | GeoJSON FeatureCollection de POIs com filtro opcional `?categoria=...` |
| `GET` | `/rotas` | Traçado viário OSRM com fallback (`origemLng`, `origemLat`, `destinoLng`, `destinoLat`, `perfil=pe\|carro`) |
| `GET` | `/pesos` | Lista de perfis de pesos padrão salvos no banco |
| `GET` | `/uploads/*` | Arquivos estáticos de imagens cacheadas localmente |

---

## 8. Licença

Este projeto é desenvolvido para fins educacionais e de pesquisa aplicada em tecnologia imobiliária e inteligência geoespacial.
