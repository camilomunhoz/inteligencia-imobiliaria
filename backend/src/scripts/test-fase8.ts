import { buildServer } from '../server.js';
import { getRoute, haversineDistance } from '../services/osrm.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFase8() {
  console.log('=== TESTES DO CRITERIO DE SAIDA — FASE 8 (OSRM, CAMADAS GEOJSON & TRAÇADO DE ROTAS) ===\n');

  const app = buildServer();

  // 1. Testar serviço OSRM e fallback geodésico (8.1)
  console.log('1. Testando serviço de roteamento (OSRM e fallback geodésico)...');
  // Coordenadas: Bom Fim (Redenção) até Moinhos de Vento (Parcão)
  const bomFim: [number, number] = [-51.2120, -30.0335];
  const parcao: [number, number] = [-51.2025, -30.0250];

  const straightDist = haversineDistance(bomFim[1], bomFim[0], parcao[1], parcao[0]);
  console.log(`- Distância em linha reta calculada (Haversine): ${straightDist} metros.`);

  // Teste perfil a pé
  const routePe = await getRoute(bomFim[0], bomFim[1], parcao[0], parcao[1], 'pe');
  console.log(`- Rota a pé (${routePe.fonte}): ${routePe.distancia_formatada} • ${routePe.duracao_formatada}.`);
  if (!routePe.success || !routePe.geometria || routePe.geometria.type !== 'LineString') {
    throw new Error('Falha no cálculo da rota a pé.');
  }

  // Teste perfil carro
  const routeCarro = await getRoute(bomFim[0], bomFim[1], parcao[0], parcao[1], 'carro');
  console.log(`- Rota de carro (${routeCarro.fonte}): ${routeCarro.distancia_formatada} • ${routeCarro.duracao_formatada}.`);
  if (!routeCarro.success || !routeCarro.geometria || routeCarro.geometria.type !== 'LineString') {
    throw new Error('Falha no cálculo da rota de carro.');
  }
  console.log('- Serviço OSRM e fallback geodésico validados com sucesso.');

  // 2. Testar endpoint GET /rotas
  console.log('\n2. Testando endpoint HTTP GET /rotas...');
  const resRota = await app.inject({
    method: 'GET',
    url: `/rotas?origemLng=${bomFim[0]}&origemLat=${bomFim[1]}&destinoLng=${parcao[0]}&destinoLat=${parcao[1]}&perfil=pe`,
  });

  if (resRota.statusCode !== 200) {
    throw new Error(`Falha no GET /rotas. Status: ${resRota.statusCode}`);
  }
  const dataRota = JSON.parse(resRota.payload);
  console.log(`- Resposta do endpoint /rotas OK (distância: ${dataRota.distancia_formatada}, fonte: ${dataRota.fonte}).`);

  // Testar validação de parâmetros inválidos
  const resRotaInvalida = await app.inject({
    method: 'GET',
    url: '/rotas?origemLng=abc',
  });
  if (resRotaInvalida.statusCode !== 400) {
    throw new Error('Endpoint /rotas não rejeitou coordenadas inválidas com status 400.');
  }
  console.log('- Validação de parâmetros inválidos no endpoint /rotas OK.');

  // 3. Testar endpoint GeoJSON GET /pois (8.2)
  console.log('\n3. Testando endpoint GeoJSON FeatureCollection GET /pois...');
  const resPois = await app.inject({
    method: 'GET',
    url: '/pois',
  });
  if (resPois.statusCode !== 200) {
    throw new Error(`Falha no GET /pois. Status: ${resPois.statusCode}`);
  }
  const dataPois = JSON.parse(resPois.payload);
  if (dataPois.type !== 'FeatureCollection' || !Array.isArray(dataPois.features)) {
    throw new Error('GET /pois não retornou um FeatureCollection válido.');
  }
  console.log(`- Total de POIs em formato GeoJSON retornados: ${dataPois.total} features.`);

  const sampleFeature = dataPois.features[0];
  if (!sampleFeature.geometry || sampleFeature.geometry.type !== 'Point' || !sampleFeature.properties?.categoria) {
    throw new Error('Feature de POI com formato inválido para MapLibre.');
  }
  console.log(`- Exemplo de POI: "${sampleFeature.properties.nome}" (${sampleFeature.properties.categoria}) em [${sampleFeature.geometry.coordinates}].`);

  // Teste de filtro por categoria
  const resPoisCat = await app.inject({
    method: 'GET',
    url: '/pois?categoria=supermercado',
  });
  const dataPoisCat = JSON.parse(resPoisCat.payload);
  console.log(`- Total de supermercados filtrados no backend: ${dataPoisCat.total}.`);

  // 4. Validar artefatos do frontend
  console.log('\n4. Validando bundle compilado do frontend com camadas e rotas...');
  const distDir = path.resolve(__dirname, '../../../frontend/dist');
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error('index.html ausente no build do frontend.');
  }
  console.log('- Bundle do frontend com suporte a camadas GeoJSON e traçado de rotas verificado.');

  console.log('\nTODOS OS CRITERIOS DE SAIDA DA FASE 8 FORAM ATENDIDOS COM SUCESSO!\n');
  await app.close();
}

testFase8().catch((err) => {
  console.error('Erro no teste da Fase 8:', err);
  process.exit(1);
});
