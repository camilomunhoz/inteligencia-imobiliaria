import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { imoveis, imoveisHistoricoPreco } from '../db/schema.js';
import { scrapeUrl } from './scraper.js';
import { cleanHtml } from './cleaner.js';
import { extractWithOllama } from './llm.js';
import { geocodeAddress } from './geocoder.js';
import { scraperQueue } from './queue.js';
import { downloadListingImages } from './image-storage.js';

export interface ProgressCallback {
  (step: string, status: 'running' | 'done' | 'error', message: string, details?: unknown): void;
}

export interface ImportResult {
  success: boolean;
  action?: 'criado' | 'historico_atualizado';
  imovel?: unknown;
  error?: string;
  errorCode?: string;
  detalhes?: unknown;
}

export async function importarImovelPorUrl(
  url: string,
  onProgress?: ProgressCallback
): Promise<ImportResult> {
  const notify = (step: string, status: 'running' | 'done' | 'error', message: string, details?: unknown) => {
    if (onProgress) {
      try {
        onProgress(step, status, message, details);
      } catch {
        // Ignorar erros no callback
      }
    }
  };

  const trimmedUrl = url.trim();

  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    notify('validacao', 'error', 'URL inválida. A URL deve iniciar com http:// ou https://');
    return {
      success: false,
      error: 'URL inválida. A URL deve iniciar com http:// ou https://',
      errorCode: 'INVALID_URL',
    };
  }

  // 1. Checar deduplicação por url_origem
  notify('deduplicacao', 'running', 'Verificando existência do anúncio no banco de dados...');
  console.log(`[Importador] Verificando existência de ${trimmedUrl} no banco...`);
  const existente = await db
    .select()
    .from(imoveis)
    .where(eq(imoveis.urlOrigem, trimmedUrl))
    .limit(1);

  if (existente.length > 0) {
    notify('deduplicacao', 'done', `Imóvel existente detectado (ID #${existente[0].id}). O histórico de preços será atualizado.`);
  } else {
    notify('deduplicacao', 'done', 'Imóvel inédito identificado no sistema.');
  }

  // 2. Executar Raspagem com Playwright (gerenciado via fila com rate-limiting)
  notify('scraping', 'running', 'Aguardando vez na fila e abrindo navegador Playwright em modo stealth...');
  const scrapeResult = await scraperQueue.add(() => scrapeUrl(trimmedUrl));
  if (!scrapeResult.success || !scrapeResult.html) {
    const errMsg = scrapeResult.error || 'Falha ao raspar a página do anúncio.';
    notify('scraping', 'error', errMsg, { errorCode: scrapeResult.errorCode });
    return {
      success: false,
      error: errMsg,
      errorCode: scrapeResult.errorCode || 'SCRAPE_FAILED',
    };
  }
  notify('scraping', 'done', 'Conteúdo HTML da página obtido com sucesso.');

  // 3. Limpeza HTML -> Markdown limpo + imagens
  notify('limpeza', 'running', 'Higienizando DOM com Readability e gerando Markdown limpo...');
  const cleaned = cleanHtml(scrapeResult.html, trimmedUrl);
  notify('limpeza', 'done', `Higienização concluída: ${cleaned.images.length} fotos e texto estruturado extraídos.`);

  // 4. Extração estruturada com Ollama (Qwen 2.5)
  notify('llm', 'running', 'IA Local (Qwen 2.5) analisando valores, condomínio, IPTU e orientação solar...');
  let extracted;
  try {
    extracted = await extractWithOllama(cleaned.markdown, cleaned.title);
    notify('llm', 'done', `IA concluiu extração (${extracted.tipo_transacao.toUpperCase()} - Confiança: ${extracted.confianca_extracao}).`);
  } catch (llmError: unknown) {
    const err = llmError as Error;
    notify('llm', 'error', `Falha no processamento com LLM: ${err.message}`, { errorCode: 'LLM_ERROR' });
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
    notify('persistencia', 'running', `Gravando nova cotação de ${tipoTransacao} no histórico do imóvel #${imovelExistente.id}...`);
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

    notify('persistencia', 'done', 'Histórico de preços atualizado com sucesso.');
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
  notify('geocoding', 'running', `Localizando coordenadas geográficas para "${extracted.endereco}", Bairro ${extracted.bairro}...`);
  let geocode;
  try {
    geocode = await geocodeAddress(extracted.endereco, extracted.bairro);
    notify('geocoding', 'done', `Geocodificação concluída via ${geocode.fonte}: (${geocode.lat.toFixed(4)}, ${geocode.lng.toFixed(4)}).`);
  } catch (geoError: unknown) {
    const err = geoError as Error;
    notify('geocoding', 'error', `Falha ao geocodificar: ${err.message}`);
    throw err;
  }

  // 8. Persistir novo imóvel no PostgreSQL com PostGIS Point
  notify('persistencia', 'running', 'Persistindo imóvel no PostgreSQL e calculando relacionamentos espaciais PostGIS...');
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

  // Baixar fotos para armazenamento local e atualizar registro
  try {
    const localImages = await downloadListingImages(novoImovel.id, cleaned.images);
    if (localImages.length > 0) {
      await db.execute(sql`
        UPDATE imoveis SET imagens = ${JSON.stringify(localImages)}::jsonb WHERE id = ${novoImovel.id};
      `);
    }
  } catch (imgErr) {
    console.error(`[Importador] Aviso: falha ao baixar imagens locais para o imóvel #${novoImovel.id}:`, imgErr);
  }

  notify('persistencia', 'done', `Imóvel #${novoImovel.id} cadastrado com sucesso.`);

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
