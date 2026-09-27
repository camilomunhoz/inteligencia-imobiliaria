import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db, pool } from '../db/index.js';

interface SampleImovel {
  urlOrigem: string;
  tipoTransacao: 'venda' | 'aluguel';
  titulo: string;
  preco: number;
  condominio: number;
  iptu: number;
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
  // --- IMÓVEIS DE VENDA ---
  {
    urlOrigem: 'https://imoveis-poa.com/venda/apto-bom-fim-fernandes-vieira-101',
    tipoTransacao: 'venda',
    titulo: 'Apartamento 2 Dormitórios Reformado no Bom Fim',
    preco: 480000.00,
    condominio: 420.00,
    iptu: 95.00,
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
    urlOrigem: 'https://imoveis-poa.com/venda/apto-moinhos-padre-chagas-202',
    tipoTransacao: 'venda',
    titulo: 'Apartamento 3 Dormitórios com Suíte e Vaga em Moinhos de Vento',
    preco: 980000.00,
    condominio: 980.00,
    iptu: 230.00,
    areaUtil: 112.00,
    endereco: 'Rua Padre Chagas, 210 - Moinhos de Vento, Porto Alegre - RS',
    bairro: 'Moinhos de Vento',
    posicaoSolar: 'Norte',
    comentarioIa: 'Imóvel amplo com orientação solar Norte privilegiada, próximo ao Parcão e ao polo gastronômico.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0261,
    lng: -51.2005,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/venda/apto-petropolis-dario-pederneiras-303',
    tipoTransacao: 'venda',
    titulo: 'Apartamento 2 Dormitórios Próximo à Praça da Encol',
    preco: 630000.00,
    condominio: 550.00,
    iptu: 120.00,
    areaUtil: 78.00,
    endereco: 'Rua Dario Pederneiras, 450 - Petrópolis, Porto Alegre - RS',
    bairro: 'Petrópolis',
    posicaoSolar: 'Norte',
    comentarioIa: 'Ótima planta no bairro Petrópolis, living 2 ambientes integrado à cozinha americana. Região tranquila e arborizada.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1502005229762-ee1b2da97034?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0385,
    lng: -51.1880,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/venda/apto-cidade-baixa-lima-e-silva-505',
    tipoTransacao: 'venda',
    titulo: 'Studio Moderno Mobiliado na Cidade Baixa',
    preco: 310000.00,
    condominio: 320.00,
    iptu: 65.00,
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

  // --- IMÓVEIS DE ALUGUEL ---
  {
    urlOrigem: 'https://imoveis-poa.com/aluguel/apto-bom-fim-vasco-da-gama-601',
    tipoTransacao: 'aluguel',
    titulo: 'Aluguel: Apartamento 2 Dormitórios no Bom Fim',
    preco: 2400.00,
    condominio: 450.00,
    iptu: 90.00,
    areaUtil: 60.00,
    endereco: 'Rua Vasco da Gama, 420 - Bom Fim, Porto Alegre - RS',
    bairro: 'Bom Fim',
    posicaoSolar: 'Leste',
    comentarioIa: 'Apartamento aconchegante para alugar a poucos passos da Redenção e do Zaffari. Prédio com elevador e interfone.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0340,
    lng: -51.2090,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/aluguel/apto-moinhos-dinarte-ribeiro-702',
    tipoTransacao: 'aluguel',
    titulo: 'Aluguel: 3 Dormitórios com Suíte e Garagem em Moinhos de Vento',
    preco: 4200.00,
    condominio: 950.00,
    iptu: 210.00,
    areaUtil: 95.00,
    endereco: 'Rua Dinarte Ribeiro, 180 - Moinhos de Vento, Porto Alegre - RS',
    bairro: 'Moinhos de Vento',
    posicaoSolar: 'Norte',
    comentarioIa: 'Apartamento de alto padrão para locação em rua nobre de Moinhos. Living com piso em tabuão e sol da manhã.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0245,
    lng: -51.2020,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/aluguel/apto-menino-deus-getulio-803',
    tipoTransacao: 'aluguel',
    titulo: 'Aluguel: Apartamento 2 Dormitórios com Sacada no Menino Deus',
    preco: 2100.00,
    condominio: 380.00,
    iptu: 75.00,
    areaUtil: 55.00,
    endereco: 'Avenida Getúlio Vargas, 650 - Menino Deus, Porto Alegre - RS',
    bairro: 'Menino Deus',
    posicaoSolar: 'Oeste',
    comentarioIa: 'Excelente custo-benefício de locação, próximo ao Shopping Praia de Belas e hospitais. Ponto de ônibus na porta.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1502005229762-ee1b2da97034?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0510,
    lng: -51.2210,
  },
  {
    urlOrigem: 'https://imoveis-poa.com/aluguel/apto-petropolis-felipe-de-oliveira-904',
    tipoTransacao: 'aluguel',
    titulo: 'Aluguel: Apartamento 2 Dormitórios Semi-Mobiliado em Petrópolis',
    preco: 3100.00,
    condominio: 620.00,
    iptu: 130.00,
    areaUtil: 75.00,
    endereco: 'Rua Felipe de Oliveira, 890 - Petrópolis, Porto Alegre - RS',
    bairro: 'Petrópolis',
    posicaoSolar: 'Norte',
    comentarioIa: 'Imóvel semi-mobiliado com armários embutidos na cozinha e dormitórios. Local calmo e seguro a 5 minutos da Encol.',
    confiancaExtracao: 'alta',
    imagens: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
    ],
    lat: -30.0390,
    lng: -51.1890,
  },
];

async function main() {
  console.log('=== POPULANDO BASE COM IMÓVEIS (VENDA E ALUGUEL) ===\n');

  // Limpar dados anteriores
  await db.execute(sql`DELETE FROM imoveis;`);

  for (const item of SAMPLE_IMOVEIS) {
    const precoM2 = Number((item.preco / item.areaUtil).toFixed(2));
    const custoTotalMensal =
      item.tipoTransacao === 'aluguel'
        ? Number((item.preco + item.condominio + item.iptu).toFixed(2))
        : null;

    const res = await db.execute(sql`
      INSERT INTO imoveis (
        url_origem,
        tipo_transacao,
        titulo,
        preco,
        condominio,
        iptu,
        custo_total_mensal,
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
        ${item.tipoTransacao},
        ${item.titulo},
        ${item.preco},
        ${item.condominio},
        ${item.iptu},
        ${custoTotalMensal},
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
      RETURNING id, tipo_transacao, titulo, preco, condominio, iptu, custo_total_mensal, preco_m2, bairro;
    `);

    const row = res.rows[0] as {
      id: number;
      tipo_transacao: string;
      titulo: string;
      preco: string;
      condominio: string;
      iptu: string;
      custo_total_mensal: string | null;
      preco_m2: string;
      bairro: string;
    };

    if (row.tipo_transacao === 'venda') {
      console.log(`- [VENDA]   #${row.id}: ${row.titulo} (${row.bairro}) -> R$ ${row.preco} (R$ ${row.preco_m2}/m²)`);
    } else {
      console.log(`- [ALUGUEL] #${row.id}: ${row.titulo} (${row.bairro}) -> Aluguel R$ ${row.preco} | Cond: R$ ${row.condominio} | Total: R$ ${row.custo_total_mensal}/mês`);
    }

    // Inserir histórico inicial
    await db.execute(sql`
      INSERT INTO imoveis_historico_preco (
        imovel_id,
        tipo_transacao,
        preco,
        condominio,
        iptu,
        custo_total_mensal
      ) VALUES (
        ${row.id},
        ${item.tipoTransacao},
        ${item.preco},
        ${item.condominio},
        ${item.iptu},
        ${custoTotalMensal}
      );
    `);
  }

  const totais = await db.execute(sql`
    SELECT tipo_transacao, count(*)::integer as total
    FROM imoveis
    GROUP BY tipo_transacao;
  `);

  console.log('\nDistribuição atual de imóveis:');
  console.table(totais.rows);

  await pool.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Erro ao popular imóveis:', err);
  await pool.end();
  process.exit(1);
});
