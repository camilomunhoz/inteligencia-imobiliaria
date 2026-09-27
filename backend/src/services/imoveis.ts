import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { imoveis, imoveisHistoricoPreco } from '../db/schema.js';
import { scrapeUrl } from './scraper.js';
import { cleanHtml } from './cleaner.js';
import { extractWithOllama } from './llm.js';
import { geocodeAddress } from './geocoder.js';

export interface ImportResult {
  success: boolean;
  action?: 'criado' | 'historico_atualizado';
  imovel?: unknown;
  error?: string;
  errorCode?: string;
  detalhes?: unknown;
}

export async function importarImovelPorUrl(url: string): Promise<ImportResult> {
  const trimmedUrl = url.trim();

  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return {
      success: false,
      error: 'URL inválida. A URL deve iniciar com http:// ou https://',
      errorCode: 'INVALID_URL',
    };
  }

  // 1. Checar deduplicação por url_origem
  console.log(`[Importador] Verificando existência de ${trimmedUrl} no banco...`);
  const existente = await db
    .select()
    .from(imoveis)
    .where(eq(imoveis.urlOrigem, trimmedUrl))
    .limit(1);

  // 2. Executar Raspagem com Playwright
  const scrapeResult = await scrapeUrl(trimmedUrl);
  if (!scrapeResult.success || !scrapeResult.html) {
    return {
      success: false,
      error: scrapeResult.error || 'Falha ao raspar a página do anúncio.',
      errorCode: scrapeResult.errorCode || 'SCRAPE_FAILED',
    };
  }

  // 3. Limpeza HTML -> Markdown limpo + imagens
  const cleaned = cleanHtml(scrapeResult.html, trimmedUrl);

  // 4. Extração estruturada com Ollama (Qwen 2.5)
  let extracted;
  try {
    extracted = await extractWithOllama(cleaned.markdown, cleaned.title);
  } catch (llmError: unknown) {
    const err = llmError as Error;
    return {
      success: false,
      error: `Falha no processamento com LLM: ${err.message}`,
      errorCode: 'LLM_ERROR',
    };
  }

  // 5. Validação numérica pós-LLM e cálculo de métricas
  const tipoTransacao = extracted.tipo_transacao;
  const preco = Number(extracted.preco);
  const condominio = Number(extracted.condominio) || 0;
  const iptu = Number(extracted.iptu) || 0;
  const areaUtil = Number(extracted.area_util);
  const precoM2 = areaUtil > 0 ? Number((preco / areaUtil).toFixed(2)) : null;
  const custoTotalMensal =
    tipoTransacao === 'aluguel' ? Number((preco + condominio + iptu).toFixed(2)) : null;

  // 6. Se o imóvel já existia, atualizar apenas preço e histórico
  if (existente.length > 0) {
    const imovelExistente = existente[0];
    console.log(`[Importador] Imóvel já cadastrado (ID ${imovelExistente.id}). Gravando novo preço no histórico...`);

    // Inserir novo histórico de preço
    await db.insert(imoveisHistoricoPreco).values({
      imovelId: imovelExistente.id,
      tipoTransacao,
      preco: String(preco),
      condominio: String(condominio),
      iptu: String(iptu),
      custoTotalMensal: custoTotalMensal ? String(custoTotalMensal) : null,
    });

    // Atualizar registro atual
    const updated = await db
      .update(imoveis)
      .set({
        tipoTransacao,
        preco: String(preco),
        condominio: String(condominio),
        iptu: String(iptu),
        custoTotalMensal: custoTotalMensal ? String(custoTotalMensal) : null,
        precoM2: precoM2 ? String(precoM2) : null,
        atualizadoEm: new Date(),
      })
      .where(eq(imoveis.id, imovelExistente.id))
      .returning();

    return {
      success: true,
      action: 'historico_atualizado',
      imovel: updated[0],
      detalhes: {
        mensagem: 'Imóvel existente atualizado com nova cotação no histórico de preços.',
      },
    };
  }

  // 7. Geocodificação
  const geocode = await geocodeAddress(extracted.endereco, extracted.bairro);

  // 8. Persistir novo imóvel no PostgreSQL com PostGIS Point
  console.log(`[Importador] Gravando novo imóvel (${tipoTransacao}) no banco...`);
  const inserted = await db.execute(sql`
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
      ${trimmedUrl},
      ${tipoTransacao},
      ${extracted.titulo},
      ${preco},
      ${condominio},
      ${iptu},
      ${custoTotalMensal},
      ${areaUtil},
      ${precoM2},
      ${extracted.endereco},
      ${extracted.bairro},
      ${extracted.posicao_solar || 'Indefinido'},
      ${extracted.comentario_analise},
      ${extracted.confianca_extracao},
      ${JSON.stringify(cleaned.images)}::jsonb,
      ST_SetSRID(ST_MakePoint(${geocode.lng}, ${geocode.lat}), 4326)
    )
    RETURNING id, tipo_transacao, titulo, preco, condominio, iptu, custo_total_mensal, area_util, preco_m2, endereco, bairro, posicao_solar, confianca_extracao, ST_AsText(geom) as geom_wkt;
  `);

  const novoImovel = inserted.rows[0] as { id: number; tipo_transacao: string; titulo: string; preco: string; area_util: string };

  // Gravar histórico inicial de preço
  await db.insert(imoveisHistoricoPreco).values({
    imovelId: novoImovel.id,
    tipoTransacao,
    preco: String(preco),
    condominio: String(condominio),
    iptu: String(iptu),
    custoTotalMensal: custoTotalMensal ? String(custoTotalMensal) : null,
  });

  return {
    success: true,
    action: 'criado',
    imovel: novoImovel,
    detalhes: {
      geocoding: geocode,
      total_imagens: cleaned.images.length,
    },
  };
}
