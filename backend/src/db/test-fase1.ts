import { sql } from 'drizzle-orm';
import { db, pool } from './index.js';

async function testFase1() {
  console.log('=== TESTE DE CRITERIO DE SAIDA - FASE 1 ===');
  try {
    // 1. Limpar dados anteriores de teste se existirem
    await db.execute(sql`DELETE FROM imoveis WHERE url_origem = 'https://exemplo.com/imovel-teste-1';`);
    await db.execute(sql`DELETE FROM pontos_interesse WHERE nome = 'Parque Farroupilha (Redenção) - Teste';`);

    // 2. Inserir 1 imóvel de teste (ex: Bairro Bom Fim, Porto Alegre: Lat -30.0335, Lng -51.2120)
    // PostGIS Point é (Longitude, Latitude) -> (-51.2120, -30.0335)
    console.log('1. Inserindo imovel de teste no Bom Fim...');
    const imovelResult = await db.execute(sql`
      INSERT INTO imoveis (
        url_origem,
        titulo,
        preco,
        area_util,
        preco_m2,
        endereco,
        bairro,
        posicao_solar,
        comentario_ia,
        confianca_extracao,
        geom
      ) VALUES (
        'https://exemplo.com/imovel-teste-1',
        'Apartamento 2D no Bom Fim',
        450000.00,
        65.00,
        ROUND(450000.00 / 65.00, 2),
        'Rua Fernandes Vieira, 100 - Bom Fim, Porto Alegre - RS',
        'Bom Fim',
        'Norte',
        'Excelente localizacao proximo a Redencao e comercios locais.',
        'alta',
        ST_SetSRID(ST_MakePoint(-51.2120, -30.0335), 4326)
      ) RETURNING id, titulo, preco, area_util, preco_m2, ST_AsText(geom) as geom_text;
    `);

    const imovel = imovelResult.rows[0] as { id: number; titulo: string; preco: string; area_util: string; preco_m2: string; geom_text: string };
    console.log('Imovel inserido com sucesso:', imovel);

    // 3. Inserir 1 POI de teste (Parque Farroupilha / Redenção: Lat -30.0366, Lng -51.2173)
    console.log('2. Inserindo POI de teste (Redencao)...');
    const poiResult = await db.execute(sql`
      INSERT INTO pontos_interesse (
        nome,
        categoria,
        origem,
        geom
      ) VALUES (
        'Parque Farroupilha (Redenção) - Teste',
        'parque',
        'manual',
        ST_SetSRID(ST_MakePoint(-51.2173, -30.0366), 4326)
      ) RETURNING id, nome, categoria, ST_AsText(geom) as geom_text;
    `);

    const poi = poiResult.rows[0] as { id: number; nome: string; categoria: string; geom_text: string };
    console.log('POI inserido com sucesso:', poi);

    // 4. Testar calculo de distancia nativo com ST_Distance(geom::geography)
    console.log('3. Consultando distancia entre o imovel e o POI via ST_Distance(geom::geography)...');
    const distResult = await db.execute(sql`
      SELECT
        i.titulo AS imovel_titulo,
        p.nome AS poi_nome,
        ROUND(ST_Distance(i.geom::geography, p.geom::geography)::numeric, 2) AS distancia_metros,
        ROUND((ST_Distance(i.geom::geography, p.geom::geography) / 1000.0)::numeric, 3) AS distancia_km
      FROM imoveis i, pontos_interesse p
      WHERE i.id = ${imovel.id} AND p.id = ${poi.id};
    `);

    const dist = distResult.rows[0] as { imovel_titulo: string; poi_nome: string; distancia_metros: string; distancia_km: string };
    console.log('Resultado do calculo de distancia:');
    console.log(`- De: ${dist.imovel_titulo}`);
    console.log(`- Para: ${dist.poi_nome}`);
    console.log(`- Distancia linear: ${dist.distancia_metros} metros (${dist.distancia_km} km)`);

    // 5. Testar insercao na serie temporal de precos (imoveis_historico_preco)
    console.log('4. Testando insercao de serie temporal de preco...');
    const histResult = await db.execute(sql`
      INSERT INTO imoveis_historico_preco (imovel_id, preco)
      VALUES (${imovel.id}, 440000.00)
      RETURNING id, imovel_id, preco, capturado_em;
    `);
    console.log('Registro historico inserido:', histResult.rows[0]);

    // 6. Verificar pesos padrao seed
    console.log('5. Verificando perfil de pesos padrao seed...');
    const pesosResult = await db.execute(sql`SELECT * FROM pesos_configuracao WHERE nome_perfil = 'padrao';`);
    console.log('Perfil padrao:', pesosResult.rows[0]);

    // 7. Testar constraint de deduplicacao UNIQUE(url_origem)
    console.log('6. Testando constraint UNIQUE(url_origem)...');
    let duplicateRejected = false;
    try {
      await db.execute(sql`
        INSERT INTO imoveis (
          url_origem, titulo, preco, area_util, endereco
        ) VALUES (
          'https://exemplo.com/imovel-teste-1',
          'Duplicata', 500000.00, 70.00, 'Rua Teste'
        );
      `);
    } catch {
      duplicateRejected = true;
      console.log('Constraint de duplicacao funcionou: tentativa com mesma url_origem foi rejeitada!');
    }

    if (!duplicateRejected) {
      throw new Error('Falha: duplicata por url_origem deveria ter sido rejeitada');
    }

    console.log('\nTODOS OS TESTES DA FASE 1 PASSARAM COM SUCESSO!');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Erro no teste da Fase 1:', error);
    await pool.end();
    process.exit(1);
  }
}

testFase1();
