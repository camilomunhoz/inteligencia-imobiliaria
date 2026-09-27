import { buildServer } from '../server.js';
import { pool } from '../db/index.js';

interface ScoredResponseItem {
  id: number;
  titulo: string;
  tipoTransacao: string;
  preco: number;
  custoTotalMensal: number;
  precoM2: number;
  bairro: string;
  distanciaRedencao: number;
  distanciaParcao: number;
  comercio1km: number;
  scoreFinal: number;
  subScores: {
    preco: number;
    posicaoSolar: number;
    distanciaRedencao: number;
    distanciaParcao: number;
    distanciaSaidaPoa: number;
    comercioProximo: number;
  };
}

async function main() {
  console.log('=== TESTES DO CRITÉRIO DE SAÍDA — FASE 4 (MOTOR DE SCORING) ===\n');

  const app = buildServer();

  // 1. Testar listagem e scoring de VENDAS
  console.log('1. Testando scoring particionado para [VENDA]...');
  const resVenda = await app.inject({
    method: 'GET',
    url: '/imoveis?tipo=venda',
  });
  if (resVenda.statusCode !== 200) throw new Error('Falha no GET /imoveis?tipo=venda');

  const dataVenda = resVenda.json() as { total: number; imoveis: ScoredResponseItem[] };
  console.log(`Total de vendas retornadas: ${dataVenda.total}`);
  console.log('\nRanking de Venda (ordenado por Score Final decrescente):');
  console.table(
    dataVenda.imoveis.map((i) => ({
      id: i.id,
      titulo: i.titulo.slice(0, 35),
      bairro: i.bairro,
      'R$/m²': `R$ ${i.precoM2.toFixed(2)}`,
      'Redenção (m)': i.distanciaRedencao,
      'Comércio 1km': i.comercio1km,
      'Nota Preço': i.subScores.preco,
      'Nota Redenção': i.subScores.distanciaRedencao,
      'SCORE FINAL': i.scoreFinal,
    }))
  );

  // Validação Venda: todos devem ser venda e ter score entre 0 e 10
  for (const item of dataVenda.imoveis) {
    if (item.tipoTransacao !== 'venda') throw new Error(`Incoerência: imóvel ${item.id} não é venda`);
    if (item.scoreFinal < 0 || item.scoreFinal > 10) throw new Error(`Score fora da faixa: ${item.scoreFinal}`);
  }

  // 2. Testar listagem e scoring de ALUGUEL
  console.log('\n2. Testando scoring particionado para [ALUGUEL]...');
  const resAluguel = await app.inject({
    method: 'GET',
    url: '/imoveis?tipo=aluguel',
  });
  if (resAluguel.statusCode !== 200) throw new Error('Falha no GET /imoveis?tipo=aluguel');

  const dataAluguel = resAluguel.json() as { total: number; imoveis: ScoredResponseItem[] };
  console.log(`Total de aluguéis retornados: ${dataAluguel.total}`);
  console.log('\nRanking de Aluguel (ordenado por Score Final decrescente):');
  console.table(
    dataAluguel.imoveis.map((i) => ({
      id: i.id,
      titulo: i.titulo.slice(0, 35),
      bairro: i.bairro,
      'Aluguel Base': `R$ ${i.preco.toFixed(2)}`,
      'Custo Total Mensal': `R$ ${i.custoTotalMensal.toFixed(2)}`,
      'Comércio 1km': i.comercio1km,
      'Nota Custo Mensal': i.subScores.preco,
      'SCORE FINAL': i.scoreFinal,
    }))
  );

  // Validação Aluguel: todos devem ser aluguel e ter score entre 0 e 10
  for (const item of dataAluguel.imoveis) {
    if (item.tipoTransacao !== 'aluguel') throw new Error(`Incoerência: imóvel ${item.id} não é aluguel`);
    if (item.scoreFinal < 0 || item.scoreFinal > 10) throw new Error(`Score fora da faixa: ${item.scoreFinal}`);
  }

  // 3. Testar endpoint individual GET /imoveis/:id/score
  const testImovel = dataVenda.imoveis[0];
  console.log(`\n3. Testando GET /imoveis/${testImovel.id}/score (detalhes individuais)...`);
  const resIndividual = await app.inject({
    method: 'GET',
    url: `/imoveis/${testImovel.id}/score`,
  });
  if (resIndividual.statusCode !== 200) throw new Error('Falha no GET /imoveis/:id/score');

  const scoreIndividual = resIndividual.json();
  console.log('Resultado do Score Individual:', JSON.stringify(scoreIndividual, null, 2));

  // 4. Testar consistência intuitiva
  // Imóvel no Bom Fim próximo à Redenção e com comércio abundante deve ter nota de comércio alta
  const bomFim = dataVenda.imoveis.find((i) => i.bairro.toLowerCase().includes('bom fim'));
  if (bomFim) {
    console.log('\nValidação intuitiva para o Bom Fim:');
    console.log(`- Distância Redenção: ${bomFim.distanciaRedencao}m (Nota Redenção: ${bomFim.subScores.distanciaRedencao}/10)`);
    console.log(`- Comércio próximo (1km): ${bomFim.comercio1km} estabelecimentos (Nota Comércio: ${bomFim.subScores.comercioProximo}/10)`);
    if (bomFim.subScores.distanciaRedencao < 7.0) {
      throw new Error('Falha intuitiva: imóvel a menos de 500m da Redenção deveria pontuar alto no critério Redenção');
    }
  }

  console.log('\nTODOS OS CRITÉRIOS DE SAÍDA DA FASE 4 FORAM ATENDIDOS COM SUCESSO!');
  await app.close();
  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro nos testes da Fase 4:', err);
  await pool.end();
  process.exit(1);
});
