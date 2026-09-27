import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

export interface ScoreWeights {
  pesoPrecoM2: number;
  pesoCustoMensal: number;
  pesoPosicaoSolar: number;
  pesoDistanciaRedencao: number;
  pesoDistanciaParcao: number;
  pesoDistanciaSaidaPoa: number;
  pesoComercioProximo: number;
}

export interface ImovelMetrics {
  id: number;
  titulo: string;
  tipoTransacao: 'venda' | 'aluguel';
  preco: number;
  condominio: number;
  iptu: number;
  custoTotalMensal: number;
  areaUtil: number;
  precoM2: number;
  bairro: string;
  posicaoSolar: string;
  distanciaRedencao: number; // metros
  distanciaParcao: number; // metros
  distanciaSaidaPoa: number; // metros
  comercio1km: number; // quantidade de farmácias, padarias e supermercados
  farmacias1km: number;
  supermercados1km: number;
  padarias1km: number;
}

export interface SubScores {
  preco: number; // 0 a 10 (preço/m² para venda, custo mensal para aluguel)
  posicaoSolar: number; // 0 a 10
  distanciaRedencao: number; // 0 a 10
  distanciaParcao: number; // 0 a 10
  distanciaSaidaPoa: number; // 0 a 10
  comercioProximo: number; // 0 a 10
}

export interface ScoredImovel extends ImovelMetrics {
  subScores: SubScores;
  scoreFinal: number; // 0 a 10
}

// Winsorização para mitigar distorções causadas por outliers extremos
function winsorize(values: number[], lowerPercentile = 0.05, upperPercentile = 0.95): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  if (values.length === 1) return { min: values[0] * 0.9, max: values[0] * 1.1 || 1 };

  const sorted = [...values].sort((a, b) => a - b);
  const lowerIndex = Math.floor(sorted.length * lowerPercentile);
  const upperIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * upperPercentile) - 1);

  return {
    min: sorted[lowerIndex],
    max: sorted[upperIndex],
  };
}

// Normalização invertida (menor valor = maior nota, ex: preço, distâncias)
function normalizeInverted(value: number, min: number, max: number): number {
  if (max <= min) return 5.0;
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (max - clamped) / (max - min);
  return Number((normalized * 10).toFixed(1));
}

// Normalização direta (maior valor = maior nota, ex: densidade de comércio)
function normalizeDirect(value: number, min: number, max: number): number {
  if (max <= min) return 5.0;
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (clamped - min) / (max - min);
  return Number((normalized * 10).toFixed(1));
}

function calculateSolarScore(solar: string): number {
  const s = solar?.toLowerCase() || '';
  if (s.includes('norte')) return 10.0; // Maior incidência no inverno (Porto Alegre)
  if (s.includes('leste')) return 8.5;  // Sol da manhã
  if (s.includes('oeste')) return 7.0;  // Sol da tarde
  if (s.includes('sul')) return 5.0;    // Baixa insolação
  return 7.0; // Indefinido / neutro
}

export async function getScoreWeights(tipo: 'venda' | 'aluguel'): Promise<ScoreWeights> {
  const perfilNome = tipo === 'aluguel' ? 'aluguel_padrao' : 'venda_padrao';

  const res = await db.execute(sql`
    SELECT
      peso_preco_m2,
      peso_custo_mensal,
      peso_posicao_solar,
      peso_distancia_redencao,
      peso_distancia_parcao,
      peso_distancia_saida_poa,
      peso_comercio_proximo
    FROM pesos_configuracao
    WHERE nome_perfil = ${perfilNome}
    LIMIT 1;
  `);

  if (res.rows.length === 0) {
    // Pesos default caso a linha não exista
    if (tipo === 'aluguel') {
      return {
        pesoPrecoM2: 0.5,
        pesoCustoMensal: 2.0,
        pesoPosicaoSolar: 1.0,
        pesoDistanciaRedencao: 1.0,
        pesoDistanciaParcao: 1.0,
        pesoDistanciaSaidaPoa: 1.0,
        pesoComercioProximo: 1.5,
      };
    }
    return {
      pesoPrecoM2: 1.5,
      pesoCustoMensal: 0.0,
      pesoPosicaoSolar: 1.0,
      pesoDistanciaRedencao: 1.0,
      pesoDistanciaParcao: 1.0,
      pesoDistanciaSaidaPoa: 1.0,
      pesoComercioProximo: 1.0,
    };
  }

  const row = res.rows[0] as Record<string, string>;
  return {
    pesoPrecoM2: Number(row.peso_preco_m2) || 1.0,
    pesoCustoMensal: Number(row.peso_custo_mensal) || 1.0,
    pesoPosicaoSolar: Number(row.peso_posicao_solar) || 1.0,
    pesoDistanciaRedencao: Number(row.peso_distancia_redencao) || 1.0,
    pesoDistanciaParcao: Number(row.peso_distancia_parcao) || 1.0,
    pesoDistanciaSaidaPoa: Number(row.peso_distancia_saida_poa) || 1.0,
    pesoComercioProximo: Number(row.peso_comercio_proximo) || 1.0,
  };
}

export async function fetchImoveisMetrics(tipo?: 'venda' | 'aluguel'): Promise<ImovelMetrics[]> {
  // Query espacial otimizada com PostGIS calculando distâncias aos POIs fixos e contagem ST_DWithin
  const filterClause = tipo ? sql`WHERE i.tipo_transacao = ${tipo}` : sql``;

  const res = await db.execute(sql`
    WITH marcos AS (
      SELECT
        MAX(CASE WHEN hash_id = 'manual:redencao' THEN geom END) AS geom_redencao,
        MAX(CASE WHEN hash_id = 'manual:parcao' THEN geom END) AS geom_parcao,
        MAX(CASE WHEN hash_id = 'manual:saida_poa' THEN geom END) AS geom_saida
      FROM pontos_interesse
      WHERE origem = 'manual'
    )
    SELECT
      i.id,
      i.titulo,
      i.tipo_transacao,
      i.preco::numeric,
      COALESCE(i.condominio, 0)::numeric AS condominio,
      COALESCE(i.iptu, 0)::numeric AS iptu,
      COALESCE(i.custo_total_mensal, i.preco)::numeric AS custo_total_mensal,
      i.area_util::numeric,
      COALESCE(i.preco_m2, CASE WHEN i.area_util > 0 THEN i.preco / i.area_util ELSE 0 END)::numeric AS preco_m2,
      i.bairro,
      i.posicao_solar,
      ROUND(ST_Distance(i.geom::geography, m.geom_redencao::geography)::numeric, 1) AS distancia_redencao,
      ROUND(ST_Distance(i.geom::geography, m.geom_parcao::geography)::numeric, 1) AS distancia_parcao,
      ROUND(ST_Distance(i.geom::geography, m.geom_saida::geography)::numeric, 1) AS distancia_saida,
      (
        SELECT COUNT(*)::integer
        FROM pontos_interesse p
        WHERE p.categoria IN ('supermercado', 'farmacia', 'padaria')
          AND ST_DWithin(i.geom::geography, p.geom::geography, 1000)
      ) AS comercio_1km,
      (
        SELECT COUNT(*)::integer
        FROM pontos_interesse p
        WHERE p.categoria = 'farmacia'
          AND ST_DWithin(i.geom::geography, p.geom::geography, 1000)
      ) AS farmacias_1km,
      (
        SELECT COUNT(*)::integer
        FROM pontos_interesse p
        WHERE p.categoria = 'supermercado'
          AND ST_DWithin(i.geom::geography, p.geom::geography, 1000)
      ) AS supermercados_1km,
      (
        SELECT COUNT(*)::integer
        FROM pontos_interesse p
        WHERE p.categoria = 'padaria'
          AND ST_DWithin(i.geom::geography, p.geom::geography, 1000)
      ) AS padarias_1km
    FROM imoveis i
    CROSS JOIN marcos m
    ${filterClause}
    ORDER BY i.id ASC;
  `);

  return res.rows.map((r: unknown) => {
    const row = r as Record<string, string | number>;
    return {
      id: Number(row.id),
      titulo: String(row.titulo),
      tipoTransacao: row.tipo_transacao as 'venda' | 'aluguel',
      preco: Number(row.preco),
      condominio: Number(row.condominio) || 0,
      iptu: Number(row.iptu) || 0,
      custoTotalMensal: Number(row.custo_total_mensal) || Number(row.preco),
      areaUtil: Number(row.area_util),
      precoM2: Number(row.preco_m2),
      bairro: String(row.bairro || ''),
      posicaoSolar: String(row.posicao_solar || 'Indefinido'),
      distanciaRedencao: Number(row.distancia_redencao) || 0,
      distanciaParcao: Number(row.distancia_parcao) || 0,
      distanciaSaidaPoa: Number(row.distancia_saida) || 0,
      comercio1km: Number(row.comercio_1km) || 0,
      farmacias1km: Number(row.farmacias_1km) || 0,
      supermercados1km: Number(row.supermercados_1km) || 0,
      padarias1km: Number(row.padarias_1km) || 0,
    };
  });
}

// Executa normalização e scoring particionando estritamente Venda vs Aluguel
export function scoreImoveisPartitioned(
  imoveis: ImovelMetrics[],
  weightsVenda: ScoreWeights,
  weightsAluguel: ScoreWeights
): ScoredImovel[] {
  const vendas = imoveis.filter((i) => i.tipoTransacao === 'venda');
  const alugueis = imoveis.filter((i) => i.tipoTransacao === 'aluguel');

  const scoredVendas = scoreGroup(vendas, weightsVenda, 'venda');
  const scoredAlugueis = scoreGroup(alugueis, weightsAluguel, 'aluguel');

  return [...scoredVendas, ...scoredAlugueis];
}

function scoreGroup(
  group: ImovelMetrics[],
  weights: ScoreWeights,
  tipo: 'venda' | 'aluguel'
): ScoredImovel[] {
  if (group.length === 0) return [];

  // 1. Limites com winsorização
  // Para Venda: preço/m²
  // Para Aluguel: custo total mensal
  const priceValues = group.map((i) => (tipo === 'venda' ? i.precoM2 : i.custoTotalMensal));
  const priceBounds = winsorize(priceValues);

  const redencaoBounds = winsorize(group.map((i) => i.distanciaRedencao));
  const parcaoBounds = winsorize(group.map((i) => i.distanciaParcao));
  const saidaBounds = winsorize(group.map((i) => i.distanciaSaidaPoa));
  const comercioBounds = winsorize(group.map((i) => i.comercio1km));

  return group.map((item) => {
    // Sub-scores (0 a 10)
    const priceVal = tipo === 'venda' ? item.precoM2 : item.custoTotalMensal;
    const subPreco = normalizeInverted(priceVal, priceBounds.min, priceBounds.max);
    const subSolar = calculateSolarScore(item.posicaoSolar);
    const subRedencao = normalizeInverted(item.distanciaRedencao, redencaoBounds.min, redencaoBounds.max);
    const subParcao = normalizeInverted(item.distanciaParcao, parcaoBounds.min, parcaoBounds.max);
    const subSaida = normalizeInverted(item.distanciaSaidaPoa, saidaBounds.min, saidaBounds.max);
    const subComercio = normalizeDirect(item.comercio1km, comercioBounds.min, comercioBounds.max);

    // Seleção de pesos
    const pesoPreco = tipo === 'venda' ? weights.pesoPrecoM2 : weights.pesoCustoMensal;
    const pesoSolar = weights.pesoPosicaoSolar;
    const pesoRedencao = weights.pesoDistanciaRedencao;
    const pesoParcao = weights.pesoDistanciaParcao;
    const pesoSaida = weights.pesoDistanciaSaidaPoa;
    const pesoComercio = weights.pesoComercioProximo;

    const somaPesos = pesoPreco + pesoSolar + pesoRedencao + pesoParcao + pesoSaida + pesoComercio || 1;

    const weightedTotal =
      subPreco * pesoPreco +
      subSolar * pesoSolar +
      subRedencao * pesoRedencao +
      subParcao * pesoParcao +
      subSaida * pesoSaida +
      subComercio * pesoComercio;

    const scoreFinal = Number((weightedTotal / somaPesos).toFixed(1));

    return {
      ...item,
      subScores: {
        preco: subPreco,
        posicaoSolar: subSolar,
        distanciaRedencao: subRedencao,
        distanciaParcao: subParcao,
        distanciaSaidaPoa: subSaida,
        comercioProximo: subComercio,
      },
      scoreFinal,
    };
  });
}

// Obtém o score de um único imóvel específico em relação à sua categoria
export async function getImovelScoreById(id: number): Promise<ScoredImovel | null> {
  const metrics = await fetchImoveisMetrics();
  const target = metrics.find((i) => i.id === id);
  if (!target) return null;

  const weightsVenda = await getScoreWeights('venda');
  const weightsAluguel = await getScoreWeights('aluguel');

  const scoredList = scoreImoveisPartitioned(metrics, weightsVenda, weightsAluguel);
  return scoredList.find((i) => i.id === id) || null;
}
