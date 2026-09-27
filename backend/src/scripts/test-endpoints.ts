import { buildServer } from '../server.js';

async function main() {
  console.log('=== TESTANDO ENDPOINTS DA API (FASTIFY) ===\n');
  const app = buildServer();

  // 1. GET /health
  console.log('1. Testando GET /health...');
  const resHealth = await app.inject({
    method: 'GET',
    url: '/health',
  });
  console.log('Status /health:', resHealth.statusCode, resHealth.json());
  if (resHealth.statusCode !== 200) throw new Error('Health check falhou');

  // 2. GET /imoveis
  console.log('\n2. Testando GET /imoveis...');
  const resImoveis = await app.inject({
    method: 'GET',
    url: '/imoveis',
  });
  const dataImoveis = resImoveis.json() as { total: number; imoveis: Array<{ id: number; titulo: string; preco: string }> };
  console.log(`Status /imoveis: ${resImoveis.statusCode} - Total retornado: ${dataImoveis.total}`);
  console.log('Primeiro imóvel retornado:', dataImoveis.imoveis[0]?.titulo);
  if (resImoveis.statusCode !== 200 || dataImoveis.total === 0) throw new Error('GET /imoveis falhou');

  // 3. GET /imoveis/:id
  const testId = dataImoveis.imoveis[0]?.id;
  console.log(`\n3. Testando GET /imoveis/${testId}...`);
  const resDetail = await app.inject({
    method: 'GET',
    url: `/imoveis/${testId}`,
  });
  console.log('Status /imoveis/:id:', resDetail.statusCode);
  const detail = resDetail.json() as { imovel: { titulo: string }; historico_precos: unknown[] };
  console.log('Detalhes:', detail.imovel?.titulo);
  console.log('Histórico de preços associado:', detail.historico_precos?.length, 'registros');
  if (resDetail.statusCode !== 200) throw new Error('GET /imoveis/:id falhou');

  // 4. POST /imoveis/importar com validação de payload
  console.log('\n4. Testando POST /imoveis/importar sem URL...');
  const resMissing = await app.inject({
    method: 'POST',
    url: '/imoveis/importar',
    payload: {},
  });
  console.log('Status erro esperado 400:', resMissing.statusCode, resMissing.json());
  if (resMissing.statusCode !== 400) throw new Error('Validação de payload falhou');

  console.log('\nTODOS OS ENDPOINTS FORAM TESTADOS E RESPONDERAM CORRETAMENTE!');
  await app.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro nos testes de endpoints:', err);
  process.exit(1);
});
