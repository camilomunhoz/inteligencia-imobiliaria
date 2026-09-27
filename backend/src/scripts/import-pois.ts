import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';

interface CategoryPreset {
  label: string;
  category: string;
  filters: string[];
}

const PRESETS: Record<string, CategoryPreset> = {
  parques: {
    label: 'Parques e Áreas Verdes',
    category: 'parque',
    filters: [
      'node["leisure"="park"]',
      'way["leisure"="park"]',
      'node["leisure"="garden"]',
      'node["landuse"="recreation_ground"]',
    ],
  },
  pracas: {
    label: 'Praças Urbanas',
    category: 'parque',
    filters: [
      'node["place"="square"]',
      'node["leisure"="park"]["name"~"Praça|Praca|Largo",i]',
    ],
  },
  escolas: {
    label: 'Escolas e Colégios',
    category: 'educacao',
    filters: [
      'node["amenity"="school"]',
      'node["amenity"="college"]',
      'node["amenity"="kindergarten"]',
    ],
  },
  universidades: {
    label: 'Universidades e Faculdades',
    category: 'educacao',
    filters: [
      'node["amenity"="university"]',
    ],
  },
  hospitais: {
    label: 'Hospitais e Clínicas de Saúde',
    category: 'saude',
    filters: [
      'node["amenity"="hospital"]',
      'node["amenity"="clinic"]',
    ],
  },
  academias: {
    label: 'Academias e Centros Esportivos',
    category: 'esporte',
    filters: [
      'node["leisure"="fitness_centre"]',
      'node["leisure"="sports_centre"]',
    ],
  },
  restaurantes: {
    label: 'Restaurantes e Cafés',
    category: 'alimentacao',
    filters: [
      'node["amenity"="restaurant"]',
      'node["amenity"="cafe"]',
    ],
  },
  transporte: {
    label: 'Estações e Terminais de Ônibus / Trensurb',
    category: 'transporte',
    filters: [
      'node["railway"="station"]',
      'node["amenity"="bus_station"]',
    ],
  },
};

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    brand?: string;
    leisure?: string;
    amenity?: string;
    shop?: string;
  };
}

async function fetchOverpass(query: string): Promise<OsmElement[]> {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': 'InteligenciaImobiliaria/1.0 (analise-imoveis-poa)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) continue;

      const json = (await response.json()) as { elements?: OsmElement[] };
      if (json && Array.isArray(json.elements)) {
        return json.elements;
      }
    } catch {
      // Tentar próximo endpoint
    }
  }
  return [];
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value || 'true';
    }
  }

  return options;
}

async function main() {
  const options = parseCliArgs();
  const presetKey = options.preset || options.category;
  const customFilter = options.filter;
  const customCategory = options.categoria || 'geral';

  if (!presetKey && !customFilter) {
    console.log('=== COMANDO DE IMPORTAÇÃO DE POIs DO OPENSTREETMAP ===\n');
    console.log('Uso: npm run pois:import -- --preset=<nome_do_preset>\n');
    console.log('Presets disponíveis para Porto Alegre:');
    for (const [key, p] of Object.entries(PRESETS)) {
      console.log(`  --preset=${key.padEnd(15)} : ${p.label} (categoria: '${p.category}')`);
    }
    console.log('\nExemplos de uso:');
    console.log('  npm run pois:import -- --preset=parques');
    console.log('  npm run pois:import -- --preset=pracas');
    console.log('  npm run pois:import -- --preset=escolas');
    console.log('  npm run pois:import -- --preset=hospitais');
    console.log('  npm run pois:import -- --preset=academias');
    console.log('\nFiltro customizado:');
    console.log('  npm run pois:import -- --filter=\'node["amenity"="bank"]\' --categoria=bancos\n');
    process.exit(0);
  }

  let filtersToRun: string[] = [];
  let dbCategory = '';
  let presetName = '';

  if (presetKey && PRESETS[presetKey]) {
    const preset = PRESETS[presetKey];
    presetName = preset.label;
    dbCategory = preset.category;
    filtersToRun = preset.filters;
  } else if (customFilter) {
    presetName = 'Filtro Customizado';
    dbCategory = customCategory;
    filtersToRun = [customFilter];
  } else {
    console.error(`Preset "${presetKey}" nao reconhecido. Execute sem argumentos para ver as opcoes.`);
    process.exit(1);
  }

  console.log(`\nIniciando importacao: ${presetName} (Categoria no banco: '${dbCategory}')`);

  // Bounding box de Porto Alegre: Sul, Oeste, Norte, Leste
  const bbox = '(-30.15,-51.26,-29.98,-51.12)';
  const query = `[out:json][timeout:35];
(
  ${filtersToRun.map((f) => `${f}${bbox};`).join('\n  ')}
);
out center;`;

  console.log('Consultando servidores do OpenStreetMap via Overpass API...');
  const elements = await fetchOverpass(query);
  console.log(`Elementos retornados: ${elements.length}`);

  if (elements.length === 0) {
    console.log('Nenhum elemento retornado ou servidores indisponíveis no momento.');
    process.exit(0);
  }

  // Filtrar apenas com coordenadas válidas
  const validElements = elements.filter((el) => {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    return lat != null && lon != null;
  });

  console.log(`Processando ${validElements.length} registros para o banco de dados...`);

  const batchSize = 100;
  let inseridos = 0;

  for (let i = 0; i < validElements.length; i += batchSize) {
    const batch = validElements.slice(i, i + batchSize);
    const values: string[] = [];

    for (const el of batch) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;

      const rawNome = el.tags?.name || el.tags?.brand || `${dbCategory.charAt(0).toUpperCase() + dbCategory.slice(1)} Sem Nome`;
      const safeNome = rawNome.replace(/'/g, "''").slice(0, 250);
      const hashId = `osm:${el.type}:${el.id}`;

      values.push(`(
        '${hashId}',
        '${safeNome}',
        '${dbCategory}',
        'osm',
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)
      )`);
    }

    if (values.length > 0) {
      const querySql = `
        INSERT INTO pontos_interesse (hash_id, nome, categoria, origem, geom)
        VALUES ${values.join(',\n')}
        ON CONFLICT (hash_id) DO UPDATE SET
          nome = EXCLUDED.nome,
          categoria = EXCLUDED.categoria,
          geom = EXCLUDED.geom;
      `;
      await db.execute(sql.raw(querySql));
      inseridos += values.length;
    }
  }

  console.log(`Importacao concluida! Registros inseridos/atualizados: ${inseridos}.`);

  // Exibir contagem atualizada
  const result = await db.execute(sql`
    SELECT
      categoria,
      origem,
      COUNT(*)::integer AS total
    FROM pontos_interesse
    GROUP BY categoria, origem
    ORDER BY categoria, origem;
  `);

  console.log('\nContagem atualizada de POIs na base:');
  console.table(result.rows);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro na importacao:', err);
  await pool.end();
  process.exit(1);
});
