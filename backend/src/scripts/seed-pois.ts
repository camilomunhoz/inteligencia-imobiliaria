import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';

interface ManualPoi {
  nome: string;
  categoria: 'parque' | 'referencia_pessoal' | 'supermercado' | 'farmacia' | 'padaria';
  lat: number;
  lng: number;
  hashId: string;
}

const MARCOS_FIXOS: ManualPoi[] = [
  {
    nome: 'Parque Farroupilha (Redenção)',
    categoria: 'parque',
    lat: -30.0366,
    lng: -51.2173,
    hashId: 'manual:redencao',
  },
  {
    nome: 'Parque Moinhos de Vento (Parcão)',
    categoria: 'parque',
    lat: -30.0261,
    lng: -51.2005,
    hashId: 'manual:parcao',
  },
  {
    nome: 'Saída de POA (Ponte do Guaíba / Freeway)',
    categoria: 'referencia_pessoal',
    lat: -30.0152,
    lng: -51.2132,
    hashId: 'manual:saida_poa',
  },
  {
    nome: 'Praça da Encol',
    categoria: 'parque',
    lat: -30.0375,
    lng: -51.1895,
    hashId: 'manual:encol',
  },
  {
    nome: 'Residência Referência (Petrópolis)',
    categoria: 'referencia_pessoal',
    lat: -30.0335,
    lng: -51.2050,
    hashId: 'manual:residencia',
  },
];

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OsmElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: {
    name?: string;
    amenity?: string;
    shop?: string;
    brand?: string;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFromOverpass(query: string): Promise<OsmElement[]> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`Consultando ${endpoint}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': 'InteligenciaImobiliaria/1.0 (analise-imoveis-poa)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        console.warn(`Endpoint ${endpoint} retornou status ${response.status}. Tentando proximo...`);
        continue;
      }

      const json = (await response.json()) as { elements?: OsmElement[] };
      if (json && Array.isArray(json.elements)) {
        return json.elements;
      }
    } catch (err: unknown) {
      console.warn(`Falha na conexao com ${endpoint}: ${(err as Error).message}`);
    }
  }

  return [];
}

async function fetchAllCategories(): Promise<OsmElement[]> {
  const cacheDir = path.resolve('src/data');
  const cacheFile = path.join(cacheDir, 'poa-pois-osm.json');

  const categories = [
    { name: 'farmacias', filter: 'node["amenity"="pharmacy"]' },
    { name: 'supermercados', filter: 'node["shop"="supermarket"]' },
    { name: 'padarias', filter: 'node["shop"="bakery"]' },
  ];

  const allElements: OsmElement[] = [];

  for (const cat of categories) {
    console.log(`\nBuscando ${cat.name} em Porto Alegre...`);
    const q = `[out:json][timeout:30];
(
  ${cat.filter}(-30.15,-51.26,-29.98,-51.12);
);
out body;`;

    const elements = await fetchFromOverpass(q);
    console.log(`- ${cat.name}: ${elements.length} pontos encontrados.`);
    allElements.push(...elements);
    await sleep(2000);
  }

  if (allElements.length > 0) {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(cacheFile, JSON.stringify(allElements, null, 2), 'utf-8');
    console.log(`Cache salvo em ${cacheFile} (${allElements.length} elementos).`);
    return allElements;
  }

  // Se a rede falhar completamente, carregar do cache se existir
  if (fs.existsSync(cacheFile)) {
    console.log(`Carregando dados do cache local: ${cacheFile}`);
    const raw = fs.readFileSync(cacheFile, 'utf-8');
    return JSON.parse(raw) as OsmElement[];
  }

  throw new Error('Nao foi possivel obter POIs nem pela rede nem pelo cache.');
}

async function main() {
  console.log('=== FASE 2: CARGA FRIA DE PONTOS DE INTERESSE (POIs) ===');

  try {
    // 1. Inserir marcos fixos manuais com idempotencia (upsert por hash_id)
    console.log('\n1. Inserindo marcos fixos pessoais manuais...');
    for (const marco of MARCOS_FIXOS) {
      await db.execute(sql`
        INSERT INTO pontos_interesse (
          hash_id,
          nome,
          categoria,
          origem,
          geom
        ) VALUES (
          ${marco.hashId},
          ${marco.nome},
          ${marco.categoria},
          'manual',
          ST_SetSRID(ST_MakePoint(${marco.lng}, ${marco.lat}), 4326)
        )
        ON CONFLICT (hash_id) DO UPDATE SET
          nome = EXCLUDED.nome,
          categoria = EXCLUDED.categoria,
          geom = EXCLUDED.geom;
      `);
      console.log(`- [Manual] ${marco.nome} (${marco.categoria}) OK`);
    }

    // 2. Buscar POIs urbanos do OpenStreetMap via Overpass API
    console.log('\n2. Obtendo POIs comerciais do OpenStreetMap...');
    const elements = await fetchAllCategories();

    // 3. Processar e inserir elementos do OSM em batches
    console.log(`\n3. Inserindo/atualizando ${elements.length} POIs do OSM no banco de dados...`);
    let inseridos = 0;
    const batchSize = 100;

    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      const values: string[] = [];

      for (const el of batch) {
        if (!el.lat || !el.lon) continue;

        let categoria = '';
        if (el.tags?.amenity === 'pharmacy') {
          categoria = 'farmacia';
        } else if (el.tags?.shop === 'supermarket') {
          categoria = 'supermercado';
        } else if (el.tags?.shop === 'bakery') {
          categoria = 'padaria';
        } else {
          continue;
        }

        const rawNome = el.tags?.name || el.tags?.brand || `${categoria.charAt(0).toUpperCase() + categoria.slice(1)} Local`;
        const safeNome = rawNome.replace(/'/g, "''").slice(0, 250);
        const hashId = `osm:node:${el.id}`;

        values.push(`(
          '${hashId}',
          '${safeNome}',
          '${categoria}',
          'osm',
          ST_SetSRID(ST_MakePoint(${el.lon}, ${el.lat}), 4326)
        )`);
      }

      if (values.length > 0) {
        const query = `
          INSERT INTO pontos_interesse (hash_id, nome, categoria, origem, geom)
          VALUES ${values.join(',\n')}
          ON CONFLICT (hash_id) DO UPDATE SET
            nome = EXCLUDED.nome,
            categoria = EXCLUDED.categoria,
            geom = EXCLUDED.geom;
        `;
        await db.execute(sql.raw(query));
        inseridos += values.length;
      }
    }

    console.log(`Carga de POIs concluida com sucesso. Total processado: ${inseridos}.`);

    // 4. Critério de saída: SELECT count(*) FROM pontos_interesse GROUP BY categoria
    console.log('\n=== CRITERIO DE SAIDA: CONTAGEM DE POIs POR CATEGORIA ===');
    const result = await db.execute(sql`
      SELECT
        categoria,
        origem,
        COUNT(*)::integer AS total
      FROM pontos_interesse
      GROUP BY categoria, origem
      ORDER BY categoria, origem;
    `);

    console.table(result.rows);

    const totalGeral = await db.execute(sql`SELECT count(*)::integer AS total_geral FROM pontos_interesse;`);
    console.log(`Total geral de pontos cadastrados: ${(totalGeral.rows[0] as { total_geral: number }).total_geral}`);

    await pool.end();
    console.log('\nFase 2 concluida com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('Erro na execucao da Fase 2:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
