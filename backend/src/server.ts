import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { importarImovelPorUrl } from './services/imoveis.js';
import {
  fetchImoveisMetrics,
  getScoreWeights,
  scoreImoveisPartitioned,
  getImovelScoreById,
} from './services/scoring.js';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: true,
  });

  // Health check
  app.get('/health', async () => {
    let dbStatus = 'ok';
    try {
      await db.execute(sql`SELECT 1;`);
    } catch {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    };
  });

  // Importar imóvel por URL (Venda ou Aluguel)
  app.post<{ Body: { url: string } }>('/imoveis/importar', async (request, reply) => {
    const { url } = request.body || {};

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'O campo "url" é obrigatório no corpo da requisição.',
        errorCode: 'MISSING_URL',
      });
    }

    try {
      const result = await importarImovelPorUrl(url);

      if (!result.success) {
        return reply.status(422).send(result);
      }

      return reply.status(result.action === 'criado' ? 201 : 200).send(result);
    } catch (error: unknown) {
      const err = error as Error;
      request.log.error(err);
      return reply.status(500).send({
        success: false,
        error: `Erro interno no servidor: ${err.message}`,
        errorCode: 'INTERNAL_SERVER_ERROR',
      });
    }
  });

  // Importar imóvel com streaming de progresso em tempo real (Server-Sent Events)
  app.post<{ Body: { url: string } }>('/imoveis/importar-stream', async (request, reply) => {
    const { url } = request.body || {};

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({
        success: false,
        error: 'O campo "url" é obrigatório no corpo da requisição.',
        errorCode: 'MISSING_URL',
      });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const result = await importarImovelPorUrl(url, (step, status, message, details) => {
        sendEvent({
          step,
          status,
          message,
          details,
          timestamp: new Date().toISOString(),
        });
      });

      sendEvent({
        step: 'conclusao',
        status: result.success ? 'done' : 'error',
        message: result.success
          ? (result.action === 'criado' ? 'Novo imóvel cadastrado com sucesso!' : 'Histórico de preços atualizado com sucesso!')
          : (result.error || 'Falha na ingestão do anúncio.'),
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const err = error as Error;
      request.log.error(err);
      sendEvent({
        step: 'erro',
        status: 'error',
        message: `Erro interno: ${err.message}`,
        errorCode: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString(),
      });
    } finally {
      reply.raw.end();
    }
  });

  // Listar imóveis já com scoring calculado e particionado por tipo de transação
  app.get<{ Querystring: { tipo?: string } }>('/imoveis', async (request) => {
    const tipo = request.query.tipo?.toLowerCase() as 'venda' | 'aluguel' | undefined;

    // 1. Obter métricas espaciais e brutas dos imóveis
    const rawMetrics = await fetchImoveisMetrics(tipo === 'venda' || tipo === 'aluguel' ? tipo : undefined);

    // 2. Obter pesos de Venda e Aluguel
    const weightsVenda = await getScoreWeights('venda');
    const weightsAluguel = await getScoreWeights('aluguel');

    // 3. Executar scoring particionado
    const scoredList = scoreImoveisPartitioned(rawMetrics, weightsVenda, weightsAluguel);

    // 4. Buscar metadados adicionais (imagens, url, criado_em, etc.)
    const metaRes = await db.execute(sql`
      SELECT
        id,
        url_origem,
        endereco,
        comentario_ia,
        confianca_extracao,
        imagens,
        ST_X(geom) as longitude,
        ST_Y(geom) as latitude,
        criado_em,
        atualizado_em
      FROM imoveis;
    `);

    const metaMap = new Map<number, Record<string, unknown>>();
    for (const m of metaRes.rows) {
      metaMap.set(Number((m as { id: number }).id), m as Record<string, unknown>);
    }

    // 5. Mesclar e ordenar por score final decrescente
    const fullImoveis = scoredList
      .map((item) => {
        const meta = metaMap.get(item.id) || {};
        return {
          ...item,
          ...meta,
        };
      })
      .sort((a, b) => b.scoreFinal - a.scoreFinal);

    return {
      total: fullImoveis.length,
      filtro_tipo: tipo || 'todos',
      pesos_utilizados: {
        venda: weightsVenda,
        aluguel: weightsAluguel,
      },
      imoveis: fullImoveis,
    };
  });

  // Score individual detalhado de um imóvel
  app.get<{ Params: { id: string } }>('/imoveis/:id/score', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'ID inválido.' });
    }

    const scored = await getImovelScoreById(id);
    if (!scored) {
      return reply.status(404).send({ error: 'Imóvel não encontrado.' });
    }

    const weights = await getScoreWeights(scored.tipoTransacao);

    return {
      imovel_id: scored.id,
      titulo: scored.titulo,
      tipo_transacao: scored.tipoTransacao,
      score_final: scored.scoreFinal,
      sub_scores: scored.subScores,
      metricas_brutas: {
        preco: scored.preco,
        condominio: scored.condominio,
        iptu: scored.iptu,
        custo_total_mensal: scored.custoTotalMensal,
        area_util: scored.areaUtil,
        preco_m2: scored.precoM2,
        posicao_solar: scored.posicaoSolar,
        distancia_redencao_m: scored.distanciaRedencao,
        distancia_parcao_m: scored.distanciaParcao,
        distancia_saida_poa_m: scored.distanciaSaidaPoa,
        total_comercio_1km: scored.comercio1km,
        farmacias_1km: scored.farmacias1km,
        supermercados_1km: scored.supermercados1km,
        padarias_1km: scored.padarias1km,
      },
      pesos_aplicados: weights,
    };
  });

  // Detalhes do imóvel com histórico de preços
  app.get<{ Params: { id: string } }>('/imoveis/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ error: 'ID inválido.' });
    }

    const imovelResult = await db.execute(sql`
      SELECT
        id,
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
        ST_X(geom) as longitude,
        ST_Y(geom) as latitude,
        criado_em,
        atualizado_em
      FROM imoveis
      WHERE id = ${id};
    `);

    if (imovelResult.rows.length === 0) {
      return reply.status(404).send({ error: 'Imóvel não encontrado.' });
    }

    const historicoResult = await db.execute(sql`
      SELECT id, tipo_transacao, preco, condominio, iptu, custo_total_mensal, capturado_em
      FROM imoveis_historico_preco
      WHERE imovel_id = ${id}
      ORDER BY capturado_em ASC;
    `);

    return {
      imovel: imovelResult.rows[0],
      historico_precos: historicoResult.rows,
    };
  });

  // Pesos de configuração atuais
  app.get('/pesos', async () => {
    const res = await db.execute(sql`SELECT * FROM pesos_configuracao ORDER BY id ASC;`);
    return {
      perfis: res.rows,
    };
  });

  return app;
}
