import { buildServer } from '../server.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { scraperQueue } from '../services/queue.js';
import { ensureUploadsDir } from '../services/image-storage.js';
import fs from 'node:fs';
import path from 'node:path';

async function testFase7() {
  console.log('=== TESTES DO CRITERIO DE SAIDA — FASE 7 (ROBUSTEZ, FILA, IMAGENS & HISTORICO) ===\n');

  const app = buildServer();

  // 1. Testar Fila de Scraping com Rate Limiting e Concorrencia
  console.log('1. Testando fila de scraping com rate limiting e concorrencia...');
  const timestamps: number[] = [];
  const p1 = scraperQueue.add(async () => {
    timestamps.push(Date.now());
    return 'job1';
  });
  const p2 = scraperQueue.add(async () => {
    timestamps.push(Date.now());
    return 'job2';
  });

  const [r1, r2] = await Promise.all([p1, p2]);
  console.log(`- Jobs executados com sucesso: ${r1}, ${r2}`);
  const diffMs = timestamps[1] - timestamps[0];
  console.log(`- Intervalo medido entre execuções: ${diffMs}ms (mínimo exigido: 1500ms)`);
  if (diffMs < 1400) {
    throw new Error(`Rate limiting falhou: intervalo foi de apenas ${diffMs}ms`);
  }
  console.log('- Fila e rate limiting validados com sucesso.');

  // 2. Testar armazenamento local de imagens e rota estatica
  console.log('\n2. Testando armazenamento local de imagens e rota estatica @fastify/static...');
  const testDir = await ensureUploadsDir(999);
  const dummyFile = path.join(testDir, 'foto_teste.txt');
  fs.writeFileSync(dummyFile, 'conteudo de teste');

  const resStatic = await app.inject({
    method: 'GET',
    url: '/uploads/imoveis/999/foto_teste.txt',
  });
  if (resStatic.statusCode !== 200 || resStatic.payload !== 'conteudo de teste') {
    throw new Error(`Falha ao servir arquivo estatico via /uploads/. Status: ${resStatic.statusCode}`);
  }
  console.log('- Rota /uploads/ servindo arquivos locais com sucesso.');
  // Limpar arquivo dummy
  fs.unlinkSync(dummyFile);

  // 3. Testar endpoint de listagem de imoveis para revisao manual
  console.log('\n3. Testando endpoints de revisao manual...');
  const resRevisao = await app.inject({
    method: 'GET',
    url: '/imoveis/revisao',
  });
  if (resRevisao.statusCode !== 200) {
    throw new Error(`Falha no GET /imoveis/revisao. Status: ${resRevisao.statusCode}`);
  }
  const dataRevisao = JSON.parse(resRevisao.payload);
  console.log(`- Imoveis pendentes de revisao manual encontrados: ${dataRevisao.total}`);

  // 4. Testar atualizacao de revisao manual via PUT /imoveis/:id/revisao
  console.log('\n4. Testando atualizacao manual de dados e historico de precos...');
  // Buscar um imovel existente
  const sampleRes = await db.execute(sql`SELECT id, preco, preco_m2, area_util FROM imoveis LIMIT 1;`);
  if (sampleRes.rows.length === 0) {
    throw new Error('Nenhum imovel encontrado no banco para teste.');
  }
  const sample = sampleRes.rows[0] as any;
  const originalPreco = Number(sample.preco);
  const newPreco = originalPreco + 15000;

  const resPut = await app.inject({
    method: 'PUT',
    url: `/imoveis/${sample.id}/revisao`,
    payload: {
      preco: newPreco,
      area_util: Number(sample.area_util),
      posicao_solar: 'Norte',
      confianca_extracao: 'alta',
    },
  });

  if (resPut.statusCode !== 200) {
    throw new Error(`Falha no PUT /imoveis/:id/revisao. Status: ${resPut.statusCode}`);
  }
  console.log(`- Imovel #${sample.id} revisado e atualizado de R$ ${originalPreco} para R$ ${newPreco}.`);

  // 5. Testar consulta ao historico de precos completo
  console.log('\n5. Consultando historico temporal de precos apos a revisao...');
  const resDetail = await app.inject({
    method: 'GET',
    url: `/imoveis/${sample.id}`,
  });
  const dataDetail = JSON.parse(resDetail.payload);
  console.log(`- Total de cotacoes no historico do imovel #${sample.id}: ${dataDetail.historico_precos.length}`);

  const latestQuote = dataDetail.historico_precos[dataDetail.historico_precos.length - 1];
  if (Number(latestQuote.preco) !== newPreco) {
    throw new Error(`Historico de preco nao refletiu o novo valor gravado. Valor retornado: ${latestQuote.preco}`);
  }
  console.log(`- Ultima cotacao no historico validada com valor atualizado: R$ ${latestQuote.preco}`);

  // Restaurar valor original para manter integridade dos dados de amostragem
  await app.inject({
    method: 'PUT',
    url: `/imoveis/${sample.id}/revisao`,
    payload: {
      preco: originalPreco,
      area_util: Number(sample.area_util),
      posicao_solar: 'Norte',
      confianca_extracao: 'alta',
    },
  });
  console.log(`- Valor original de R$ ${originalPreco} restaurado no imovel #${sample.id}.`);

  console.log('\nTODOS OS CRITERIOS DE SAIDA DA FASE 7 FORAM ATENDIDOS COM SUCESSO!\n');
  await app.close();
}

testFase7().catch((err) => {
  console.error('Erro no teste da Fase 7:', err);
  process.exit(1);
});
