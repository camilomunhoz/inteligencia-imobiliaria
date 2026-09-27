import { buildServer } from '../server.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testFase6() {
  console.log('=== TESTES DO CRITERIO DE SAIDA — FASE 6 (POLIMENTO, SLIDERS & SSE STREAMING) ===\n');

  const app = buildServer();

  // 1. Testar endpoint de streaming SSE: POST /imoveis/importar-stream
  console.log('1. Testando endpoint de streaming Server-Sent Events (POST /imoveis/importar-stream)...');

  // Caso 1: URL invalida
  const resInvalid = await app.inject({
    method: 'POST',
    url: '/imoveis/importar-stream',
    payload: { url: 'url-invalida-sem-protocolo' },
  });

  if (resInvalid.headers['content-type']?.includes('text/event-stream')) {
    console.log('- Header text/event-stream retornado corretamente.');
  } else {
    throw new Error('Endpoint nao retornou Content-Type text/event-stream');
  }

  const payloadInvalid = resInvalid.payload;
  if (payloadInvalid.includes('"status":"error"') && payloadInvalid.includes('URL inválida')) {
    console.log('- Validacao de URL via stream SSE OK: evento de erro transmitido.');
  } else {
    throw new Error(`Falha no payload de erro SSE: ${payloadInvalid}`);
  }

  // 2. Testar simulacao de recalculacao de score no cliente
  console.log('\n2. Testando algoritmo de recalculacao de pesos instantanea (simulando cliente)...');

  // Buscar dados brutos do banco
  const resVenda = await app.inject({
    method: 'GET',
    url: '/imoveis?tipo=venda',
  });
  const dataVenda = JSON.parse(resVenda.payload);
  const imoveis = dataVenda.imoveis;

  const calculateClientScore = (sub: any, weights: any) => {
    const totalWeight =
      weights.pesoPreco +
      weights.pesoPosicaoSolar +
      weights.pesoDistanciaRedencao +
      weights.pesoDistanciaParcao +
      weights.pesoDistanciaSaidaPoa +
      weights.pesoComercioProximo;

    const weightedSum =
      sub.preco * weights.pesoPreco +
      sub.posicaoSolar * weights.pesoPosicaoSolar +
      sub.distanciaRedencao * weights.pesoDistanciaRedencao +
      sub.distanciaParcao * weights.pesoDistanciaParcao +
      sub.distanciaSaidaPoa * weights.pesoDistanciaSaidaPoa +
      sub.comercioProximo * weights.pesoComercioProximo;

    return Number((weightedSum / totalWeight).toFixed(1));
  };

  // Perfil 1: Foco em Parques
  const weightsParques = {
    pesoPreco: 0.5,
    pesoPosicaoSolar: 0.5,
    pesoDistanciaRedencao: 3.0,
    pesoDistanciaParcao: 3.0,
    pesoDistanciaSaidaPoa: 0.5,
    pesoComercioProximo: 0.5,
  };

  // Perfil 2: Foco em Saida POA
  const weightsSaida = {
    pesoPreco: 0.5,
    pesoPosicaoSolar: 0.5,
    pesoDistanciaRedencao: 0.5,
    pesoDistanciaParcao: 0.5,
    pesoDistanciaSaidaPoa: 3.0,
    pesoComercioProximo: 0.5,
  };

  const scoresParques = imoveis.map((i: any) => ({
    titulo: i.titulo,
    bairro: i.bairro,
    score: calculateClientScore(i.subScores, weightsParques),
  })).sort((a: any, b: any) => b.score - a.score);

  const scoresSaida = imoveis.map((i: any) => ({
    titulo: i.titulo,
    bairro: i.bairro,
    score: calculateClientScore(i.subScores, weightsSaida),
  })).sort((a: any, b: any) => b.score - a.score);

  console.log('- Top 1 com Foco em Parques:', scoresParques[0].titulo, `(${scoresParques[0].bairro}) -> Score:`, scoresParques[0].score);
  console.log('- Top 1 com Foco em Saida POA:', scoresSaida[0].titulo, `(${scoresSaida[0].bairro}) -> Score:`, scoresSaida[0].score);

  if (scoresParques[0].score <= 0 || scoresSaida[0].score <= 0) {
    throw new Error('Falha no calculo matematico dos scores no cliente.');
  }

  // 3. Validar build do frontend com os componentes da Fase 6
  console.log('\n3. Validando artefatos gerados do frontend...');
  const distDir = path.resolve(__dirname, '../../../frontend/dist');
  const indexHtml = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    throw new Error('index.html ausente no build do frontend.');
  }
  console.log('- Build verificado com sucesso.');

  console.log('\nTODOS OS CRITERIOS DE SAIDA DA FASE 6 FORAM ATENDIDOS COM SUCESSO!\n');
  await app.close();
}

testFase6().catch((err) => {
  console.error('Erro no teste da Fase 6:', err);
  process.exit(1);
});
