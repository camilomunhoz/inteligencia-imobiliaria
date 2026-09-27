import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';

interface SampleImovel {
  urlOrigem: string;
  titulo: string;
  preco: number;
  areaUtil: number;
  endereco: string;
  bairro: string;
  posicaoSolar: string;
  comentarioIa: string;
  confiancaExtracao: string;
  imagens: string[];
  lat: number;
  lng: number;
}

const SAMPLE_IMOVEIS: SampleImovel[] = [
  {
    urlOrigem: 'https://imoveis-poa.com/anuncio/apto-bom-fim-fernandes-vieira-101',
    titulo: 'Apartamento 2 Dormitórios Reformado no Bom Fim',
    preco: 480000.00,
    areaUtil: 65.00,
    endereco: 'Rua Fernandes Vieira, 350 - Bom Fim, Porto Alegre - RS',
    bairro: 'Bom Fim',
    posicaoSolar: 'Leste',
    comentarioIa: 'Excelente localização no coração do Bom Fim, a duas quadras da Redenção. Reformado recentemente com sol da manhã.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0335,
    lng: -51.2120,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/anuncio/apto-moinhos-de-vento-padre-chagas-202',
    titulo: 'Apartamento 3 Dormitórios com Suíte e Vaga em Moinhos de Vento',
    preco: 980000.00,
    areaUtil: 112.00,
    endereco: 'Rua Padre Chagas, 210 - Moinhos de Vento, Porto Alegre - RS',
    bairro: 'Moinhos de Vento',
    posicaoSolar: 'Norte',
    comentarioIa: 'Imóvel amplo com orientação solar Norte privilegiada, próximo ao Parcão e ao polo gastronômico. Valor de condomínio compatível.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0261,
    lng: -51.2005,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/anuncio/apto-petropolis-dario-pederneiras-303',
    titulo: 'Apartamento 2 Dormitórios Próximo à Praça da Encol',
    preco: 630000.00,
    areaUtil: 78.00,
    endereco: 'Rua Dario Pederneiras, 450 - Petrópolis, Porto Alegre - RS',
    bairro: 'Petrópolis',
    posicaoSolar: 'Norte',
    comentarioIa: 'Ótima planta no bairro Petrópolis, living 2 ambientes integrado à cozinha americana. Região tranquila e arborizada.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1502005229762-ee1b2da97034?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0385,
    lng: -51.1880,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/anuncio/apto-menino-deus-getulio-vargas-404',
    titulo: 'Apartamento 2 Dormitórios com Sacada no Menino Deus',
    preco: 420000.00,
    areaUtil: 60.00,
    endereco: 'Avenida Getúlio Vargas, 780 - Menino Deus, Porto Alegre - RS',
    bairro: 'Menino Deus',
    posicaoSolar: 'Oeste',
    comentarioIa: 'Localizado no Menino Deus próximo a supermercados e farmácias. Sol poente e ótima ventilação cruzada.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0520,
    lng: -51.2220,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/anuncio/apto-cidade-baixa-lima-e-silva-505',
    titulo: 'Studio Moderno Mobiliado na Cidade Baixa',
    preco: 310000.00,
    areaUtil: 42.00,
    endereco: 'Rua General Lima e Silva, 520 - Cidade Baixa, Porto Alegre - RS',
    bairro: 'Cidade Baixa',
    posicaoSolar: 'Leste',
    comentarioIa: 'Compacto e funcional, ideal para locação ou moradia prática. Próximo à UFRGS e polo de serviços.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0400,
    lng: -51.2220,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/anuncio/apto-floresta-cristovao-colombo-606',
    titulo: 'Apartamento 2 Dormitórios no Floresta Próximo ao Shopping Total',
    preco: 350000.00,
    areaUtil: 56.00,
    endereco: 'Avenida Cristóvão Colombo, 900 - Floresta, Porto Alegre - RS',
    bairro: 'Floresta',
    posicaoSolar: 'Sul',
    comentarioIa: 'Excelente acesso à saída de Porto Alegre e zona central. Prédio com baixo custo condominial.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0220,
    lng: -51.2100,
  }
];

async function main() {
  console.log('=== POPULANDO BASE COM IMÓVEIS REAIS DE PORTO ALEGRE ===\n');

  // Limpar dados anteriores de teste
  await db.execute(sql`DELETE FROM imoveis WHERE id = 3 OR url_origem LIKE '%raw.githubusercontent%';`);

  for (const item of SAMPLE_IMOVEIS) {
    const precoM2 = Number((item.preco / item.areaUtil).toFixed(2));

    const res = await db.execute(sql`
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
        imagens,
        geom
      ) VALUES (
        ${item.urlOrigem},
        ${item.titulo},
        ${item.preco},
        ${item.areaUtil},
        ${precoM2},
        ${item.endereco},
        ${item.bairro},
        ${item.posicaoSolar},
        ${item.comentarioIa},
        ${item.confiancaExtracao},
        ${JSON.stringify(item.imagens)}::jsonb,
        ST_SetSRID(ST_MakePoint(${item.lng}, ${item.lat}), 4326)
      )
      ON CONFLICT (url_origem) DO UPDATE SET
        preco = EXCLUDED.preco,
        preco_m2 = EXCLUDED.preco_m2,
        atualizado_em = NOW()
      RETURNING id, titulo, preco, area_util, preco_m2, bairro, posicao_solar;
    `);

    const row = res.rows[0] as { id: number; titulo: string; preco: string; preco_m2: string; bairro: string };
    console.log(`- Imóvel #${row.id}: ${row.titulo} (${row.bairro}) - R$ ${row.preco} (R$ ${row.preco_m2}/m²)`);

    // Inserir histórico de preço
    await db.execute(sql`
      INSERT INTO imoveis_historico_preco (imovel_id, preco)
      VALUES (${row.id}, ${item.preco})
      ON CONFLICT DO NOTHING;
    `);
  }

  const total = await db.execute(sql`SELECT count(*)::integer as count FROM imoveis;`);
  console.log(`\nBase populada com sucesso! Total de imóveis cadastrados: ${(total.rows[0] as { count: number }).count}`);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro ao popular imóveis:', err);
  await pool.end();
  process.exit(1);
});
