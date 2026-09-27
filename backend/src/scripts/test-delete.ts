import { buildServer } from '../server.js';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import { ensureUploadsDir } from '../services/image-storage.js';
import fs from 'node:fs';
import path from 'node:path';

async function testDelete() {
  console.log('=== TESTE DELETAR IMÓVEL E IMAGENS EM DISCO ===\n');

  const app = buildServer();

  // 1. Criar um imóvel de teste no banco
  const insertRes = await db.execute(sql`
    INSERT INTO imoveis (
      url_origem,
      tipo_transacao,
      titulo,
      preco,
      area_util,
      endereco,
      bairro,
      posicao_solar,
      geom
    ) VALUES (
      'https://teste-delete.com/imovel-temporario',
      'venda',
      'Imóvel Temporário para Teste de Exclusão',
      350000.00,
      50.00,
      'Rua dos Testes, 123',
      'Centro Histórico',
      'Norte',
      ST_SetSRID(ST_MakePoint(-51.22, -30.03), 4326)
    ) RETURNING id;
  `);

  const imovelId = Number(insertRes.rows[0].id);
  console.log(`- Imóvel temporário criado com ID #${imovelId}`);

  // Inserir histórico de preço para testar cascade
  await db.execute(sql`
    INSERT INTO imoveis_historico_preco (imovel_id, tipo_transacao, preco, custo_total_mensal)
    VALUES (${imovelId}, 'venda', 350000.00, 350000.00);
  `);

  // 2. Criar imagens de teste na pasta de uploads
  const imgDir = await ensureUploadsDir(imovelId);
  const testImg = path.join(imgDir, 'foto_0.jpg');
  fs.writeFileSync(testImg, 'dados binarios simulados');
  console.log(`- Arquivo de imagem teste criado em: ${testImg}`);

  if (!fs.existsSync(testImg)) {
    throw new Error('Falha ao criar imagem temporária para o teste.');
  }

  // 3. Executar DELETE via Fastify
  console.log(`- Chamando DELETE /imoveis/${imovelId}...`);
  const response = await app.inject({
    method: 'DELETE',
    url: `/imoveis/${imovelId}`,
  });

  if (response.statusCode !== 200) {
    throw new Error(`Falha no DELETE. Status: ${response.statusCode}, payload: ${response.payload}`);
  }

  const payload = JSON.parse(response.payload);
  console.log(`- Resposta da API:`, payload);

  // 4. Verificar se foi apagado do banco de dados
  const checkDb = await db.execute(sql`
    SELECT id FROM imoveis WHERE id = ${imovelId};
  `);
  if (checkDb.rows.length !== 0) {
    throw new Error('Falha: Imóvel ainda consta no banco de dados após DELETE.');
  }
  console.log('- Imóvel removido com sucesso do banco de dados.');

  // Verificar histórico (cascade)
  const checkHist = await db.execute(sql`
    SELECT id FROM imoveis_historico_preco WHERE imovel_id = ${imovelId};
  `);
  if (checkHist.rows.length !== 0) {
    throw new Error('Falha: Histórico de preço não foi removido em cascata.');
  }
  console.log('- Histórico em cascata removido com sucesso.');

  // 5. Verificar se a pasta em disco foi apagada
  if (fs.existsSync(imgDir)) {
    throw new Error(`Falha: Pasta de imagens ${imgDir} ainda existe no disco.`);
  }
  console.log('- Diretório de uploads e imagens em disco apagados com sucesso.');

  // 6. Testar 404 para ID inexistente
  const res404 = await app.inject({
    method: 'DELETE',
    url: `/imoveis/${imovelId}`,
  });
  if (res404.statusCode !== 404) {
    throw new Error(`Esperado status 404 para imóvel já excluído, recebido: ${res404.statusCode}`);
  }
  console.log('- Tratamento de erro 404 para ID inexistente validado com sucesso.');

  console.log('\n=== TODOS OS TESTES DE DELEÇÃO PASSARAM COM SUCESSO! ===');
  process.exit(0);
}

testDelete().catch((err) => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
