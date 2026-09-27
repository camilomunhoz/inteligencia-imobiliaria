import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { importarImovelPorUrl } from './services/imoveis.js';

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

  // Listar imóveis com suporte a filtro opcional por tipo (?tipo=venda ou ?tipo=aluguel)
  app.get<{ Querystring: { tipo?: string } }>('/imoveis', async (request) => {
    const tipo = request.query.tipo?.toLowerCase();

    let query;
    if (tipo === 'venda' || tipo === 'aluguel') {
      query = sql`
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
        WHERE tipo_transacao = ${tipo}
        ORDER BY criado_em DESC;
      `;
    } else {
      query = sql`
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
        ORDER BY criado_em DESC;
      `;
    }

    const result = await db.execute(query);

    return {
      total: result.rows.length,
      filtro_tipo: tipo || 'todos',
      imoveis: result.rows,
    };
  });

  // Detalhes do imóvel com série temporal de preços
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

  return app;
}
